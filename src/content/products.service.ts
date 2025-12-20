import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Content } from './entities/content.entity';
import { Product } from './entities/product.entity';
import { Tag } from './entities/tag.entity';
import { ContentTag } from './entities/content-tag.entity';
import { ContentVersion } from './entities/content-version.entity';
import { ContentType } from './enums/content-type.enum';
import { ContentStatus } from './enums/content-status.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class ProductsService {
  constructor(private readonly em: EntityManager) {}

  async create(dto: CreateProductDto, user: User): Promise<Record<string, unknown>> {
    // Check for existing slug
    const existingSlug = await this.em.findOne(Content, {
      slug: dto.slug,
      locale: dto.locale || 'en',
      deletedAt: null,
    });
    if (existingSlug) {
      throw new ConflictException('Product with this slug already exists');
    }

    // Check for existing SKU if provided
    if (dto.sku) {
      const existingSku = await this.em.findOne(Product, { sku: dto.sku });
      if (existingSku) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    // Create content
    const content = this.em.create(Content, {
      contentType: ContentType.PRODUCT,
      status: ContentStatus.DRAFT,
      slug: dto.slug,
      locale: dto.locale || 'en',
      createdBy: user,
    });

    // Create product
    const product = this.em.create(Product, {
      content,
      name: dto.name,
      description: dto.description,
      shortDescription: dto.shortDescription,
      sku: dto.sku,
      price: dto.price?.toString(),
      compareAtPrice: dto.compareAtPrice?.toString(),
      currency: dto.currency || 'USD',
      stockQuantity: dto.stockQuantity || 0,
      isFeatured: dto.isFeatured || false,
      attributes: dto.attributes || {},
      seoTitle: dto.seoTitle,
      seoDescription: dto.seoDescription,
      seoKeywords: dto.seoKeywords,
    });

    await this.em.persistAndFlush([content, product]);

    // Add tags if provided
    if (dto.tagIds && dto.tagIds.length > 0) {
      await this.addTagsInternal(content, dto.tagIds);
    }

    // Reload with relations
    await this.em.refresh(content, { populate: ['tags', 'createdBy'] });

    return this.serializeProduct(content, product);
  }

  async findAll(
    page: number,
    limit: number,
    filters: {
      status?: string;
      isFeatured?: boolean;
      search?: string;
      minPrice?: number;
      maxPrice?: number;
    },
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {
      contentType: ContentType.PRODUCT,
      deletedAt: null,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    const [contents, total] = await this.em.findAndCount(Content, where, {
      limit,
      offset,
      orderBy: { createdAt: 'DESC' },
      populate: ['createdBy', 'updatedBy', 'tags'],
    });

    // Load products for each content
    const contentIds = contents.map((c) => c.id);
    const products = await this.em.find(Product, { content: { id: { $in: contentIds } } });
    const productMap = new Map(products.map((p) => [p.content.id, p]));

    // Apply product-specific filters
    let results: Array<{ content: Content; product: Product }> = contents
      .map((content) => {
        const product = productMap.get(content.id);
        if (!product) return null;
        return { content: content as Content, product };
      })
      .filter((item) => item !== null);

    // Filter by isFeatured
    if (filters.isFeatured !== undefined) {
      results = results.filter((item) => item.product.isFeatured === filters.isFeatured);
    }

    // Filter by price range (exclude products with null price)
    if (filters.minPrice !== undefined) {
      results = results.filter((item) => {
        if (!item.product.price) return false;
        const price = parseFloat(item.product.price);
        return price >= filters.minPrice!;
      });
    }
    if (filters.maxPrice !== undefined) {
      results = results.filter((item) => {
        if (!item.product.price) return false;
        const price = parseFloat(item.product.price);
        return price <= filters.maxPrice!;
      });
    }

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(
        (item) =>
          item.product.name.toLowerCase().includes(searchLower) ||
          item.content.slug.toLowerCase().includes(searchLower) ||
          item.product.sku?.toLowerCase().includes(searchLower),
      );
    }

    return {
      data: results.map((item) => this.serializeProduct(item.content, item.product)),
      total: results.length,
    };
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const content = await this.em.findOne(
      Content,
      { id, contentType: ContentType.PRODUCT, deletedAt: null },
      { populate: ['createdBy', 'updatedBy', 'tags'] },
    );

    if (!content) {
      throw new NotFoundException('Product not found');
    }

    const product = await this.em.findOne(Product, { content: { id } });
    if (!product) {
      throw new NotFoundException('Product data not found');
    }

    return this.serializeProduct(content, product);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    user: User,
  ): Promise<Record<string, unknown>> {
    const content = await this.em.findOne(
      Content,
      { id, contentType: ContentType.PRODUCT, deletedAt: null },
      { populate: ['createdBy', 'updatedBy', 'tags'] },
    );

    if (!content) {
      throw new NotFoundException('Product not found');
    }

    const product = await this.em.findOne(Product, { content: { id } });
    if (!product) {
      throw new NotFoundException('Product data not found');
    }

    // Check for slug conflict
    if (dto.slug && dto.slug !== content.slug) {
      const existingSlug = await this.em.findOne(Content, {
        slug: dto.slug,
        locale: dto.locale || content.locale,
        deletedAt: null,
        id: { $ne: id },
      });
      if (existingSlug) {
        throw new ConflictException('Product with this slug already exists');
      }
      content.slug = dto.slug;
    }

    // Check for SKU conflict
    if (dto.sku && dto.sku !== product.sku) {
      const existingSku = await this.em.findOne(Product, {
        sku: dto.sku,
        id: { $ne: product.id },
      });
      if (existingSku) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    // Check if publishing (for auto-version)
    const isPublishing =
      dto.status === ContentStatus.PUBLISHED &&
      content.status !== ContentStatus.PUBLISHED;

    // Update content fields
    if (dto.locale) content.locale = dto.locale;
    if (dto.status) {
      content.status = dto.status as ContentStatus;
      if (dto.status === ContentStatus.PUBLISHED && !content.publishedAt) {
        content.publishedAt = new Date();
      }
    }
    content.updatedBy = user;

    // Update product fields
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.shortDescription !== undefined) product.shortDescription = dto.shortDescription;
    if (dto.sku !== undefined) product.sku = dto.sku;
    if (dto.price !== undefined) product.price = dto.price.toString();
    if (dto.compareAtPrice !== undefined) product.compareAtPrice = dto.compareAtPrice.toString();
    if (dto.currency !== undefined) product.currency = dto.currency;
    if (dto.stockQuantity !== undefined) product.stockQuantity = dto.stockQuantity;
    if (dto.isFeatured !== undefined) product.isFeatured = dto.isFeatured;
    if (dto.attributes !== undefined) product.attributes = dto.attributes;
    if (dto.seoTitle !== undefined) product.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) product.seoDescription = dto.seoDescription;
    if (dto.seoKeywords !== undefined) product.seoKeywords = dto.seoKeywords;

    // Auto-create version on publish
    if (isPublishing) {
      await this.createVersionInternal(content, product, user, 'Published version');
      content.version += 1;
    }

    await this.em.flush();

    return this.serializeProduct(content, product);
  }

  async remove(id: string): Promise<void> {
    const content = await this.em.findOne(Content, {
      id,
      contentType: ContentType.PRODUCT,
      deletedAt: null,
    });

    if (!content) {
      throw new NotFoundException('Product not found');
    }

    content.deletedAt = new Date();
    await this.em.flush();
  }

  async addTags(id: string, tagIds: string[]): Promise<void> {
    const content = await this.em.findOne(Content, {
      id,
      contentType: ContentType.PRODUCT,
      deletedAt: null,
    });

    if (!content) {
      throw new NotFoundException('Product not found');
    }

    await this.addTagsInternal(content, tagIds);
  }

  async removeTags(id: string, tagIds: string[]): Promise<void> {
    const content = await this.em.findOne(Content, {
      id,
      contentType: ContentType.PRODUCT,
      deletedAt: null,
    });

    if (!content) {
      throw new NotFoundException('Product not found');
    }

    await this.em.nativeDelete(ContentTag, {
      content: { id },
      tag: { id: { $in: tagIds } },
    });
  }

  async getTags(id: string): Promise<Tag[]> {
    const content = await this.em.findOne(
      Content,
      { id, contentType: ContentType.PRODUCT, deletedAt: null },
      { populate: ['tags'] },
    );

    if (!content) {
      throw new NotFoundException('Product not found');
    }

    return content.tags.getItems();
  }

  private async addTagsInternal(content: Content, tagIds: string[]): Promise<void> {
    const tags = await this.em.find(Tag, { id: { $in: tagIds } });
    if (tags.length !== tagIds.length) {
      throw new NotFoundException('Some tags not found');
    }

    const existingTags = await this.em.find(ContentTag, {
      content: { id: content.id },
    });
    const existingTagIds = new Set(existingTags.map((ct) => ct.tag.id));

    for (const tag of tags) {
      if (!existingTagIds.has(tag.id)) {
        const contentTag = this.em.create(ContentTag, {
          content,
          tag,
        });
        this.em.persist(contentTag);
      }
    }

    await this.em.flush();
  }

  private async createVersionInternal(
    content: Content,
    product: Product,
    user: User,
    changeSummary: string,
  ): Promise<ContentVersion> {
    const existingVersions = await this.em.find(
      ContentVersion,
      { content: { id: content.id } },
      { orderBy: { versionNumber: 'DESC' }, limit: 1 },
    );

    const versionNumber = existingVersions.length > 0
      ? existingVersions[0].versionNumber + 1
      : 1;

    const dataSnapshot = {
      contentType: content.contentType,
      status: content.status,
      slug: content.slug,
      locale: content.locale,
      version: content.version,
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      sku: product.sku,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      currency: product.currency,
      stockQuantity: product.stockQuantity,
      isFeatured: product.isFeatured,
      attributes: product.attributes,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      seoKeywords: product.seoKeywords,
    };

    const version = this.em.create(ContentVersion, {
      content,
      versionNumber,
      dataSnapshot,
      changeSummary,
      createdBy: user,
    });

    this.em.persist(version);
    await this.em.flush();

    return version;
  }

  private serializeProduct(content: Content, product: Product): Record<string, unknown> {
    return {
      id: content.id,
      contentType: content.contentType,
      status: content.status,
      slug: content.slug,
      locale: content.locale,
      version: content.version,
      isLatest: content.isLatest,
      publishedAt: content.publishedAt?.toISOString() || null,
      scheduledAt: content.scheduledAt?.toISOString() || null,
      createdBy: content.createdBy
        ? {
            id: content.createdBy.id,
            email: content.createdBy.email,
            firstName: content.createdBy.firstName,
            lastName: content.createdBy.lastName,
          }
        : null,
      updatedBy: content.updatedBy
        ? {
            id: content.updatedBy.id,
            email: content.updatedBy.email,
            firstName: content.updatedBy.firstName,
            lastName: content.updatedBy.lastName,
          }
        : null,
      createdAt: content.createdAt.toISOString(),
      updatedAt: content.updatedAt.toISOString(),
      tags: content.tags?.getItems().map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        createdAt: tag.createdAt.toISOString(),
      })) || [],
      // Product-specific fields
      name: product.name,
      description: product.description || null,
      shortDescription: product.shortDescription || null,
      sku: product.sku || null,
      price: product.price ? parseFloat(product.price) : null,
      compareAtPrice: product.compareAtPrice ? parseFloat(product.compareAtPrice) : null,
      currency: product.currency,
      stockQuantity: product.stockQuantity,
      isFeatured: product.isFeatured,
      attributes: product.attributes,
      seoTitle: product.seoTitle || null,
      seoDescription: product.seoDescription || null,
      seoKeywords: product.seoKeywords || null,
    };
  }
}
