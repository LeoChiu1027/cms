import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Content } from './entities/content.entity';
import { Blog } from './entities/blog.entity';
import { Product } from './entities/product.entity';
import { ContentVersion } from './entities/content-version.entity';
import { ContentType } from './enums/content-type.enum';
import { CreateVersionDto } from './dto/create-version.dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class ContentService {
  constructor(private readonly em: EntityManager) {}

  async findAll(
    page: number,
    limit: number,
    filters: {
      contentType?: string;
      status?: string;
      createdBy?: string;
      search?: string;
    },
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (filters.contentType) {
      where.contentType = filters.contentType;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.createdBy) {
      where.createdBy = { id: filters.createdBy };
    }

    const [contents, total] = await this.em.findAndCount(Content, where, {
      limit,
      offset,
      orderBy: { createdAt: 'DESC' },
      populate: ['createdBy', 'updatedBy', 'tags'],
    });

    // Load type-specific data
    const results = await Promise.all(
      contents.map(async (content) => {
        const typeData = await this.loadTypeData(content);
        return this.serializeContent(content, typeData);
      }),
    );

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const filtered = results.filter((item) => {
        const slug = (item.slug as string).toLowerCase();
        const typeData = item.typeData as Record<string, unknown>;
        const title = (typeData?.title as string)?.toLowerCase() || '';
        const name = (typeData?.name as string)?.toLowerCase() || '';
        return slug.includes(searchLower) || title.includes(searchLower) || name.includes(searchLower);
      });
      return { data: filtered, total: filtered.length };
    }

    return { data: results, total };
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const content = await this.em.findOne(
      Content,
      { id, deletedAt: null },
      { populate: ['createdBy', 'updatedBy', 'tags'] },
    );

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    const typeData = await this.loadTypeData(content);
    return this.serializeContent(content, typeData);
  }

  async getVersions(
    contentId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const content = await this.em.findOne(Content, { id: contentId, deletedAt: null });
    if (!content) {
      throw new NotFoundException('Content not found');
    }

    const offset = (page - 1) * limit;

    const [versions, total] = await this.em.findAndCount(
      ContentVersion,
      { content: { id: contentId } },
      {
        limit,
        offset,
        orderBy: { versionNumber: 'DESC' },
        populate: ['createdBy'],
      },
    );

    return {
      data: versions.map((v) => this.serializeVersion(v)),
      total,
    };
  }

  async getVersion(contentId: string, versionId: string): Promise<Record<string, unknown>> {
    const content = await this.em.findOne(Content, { id: contentId, deletedAt: null });
    if (!content) {
      throw new NotFoundException('Content not found');
    }

    const version = await this.em.findOne(
      ContentVersion,
      { id: versionId, content: { id: contentId } },
      { populate: ['createdBy'] },
    );

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    return this.serializeVersion(version);
  }

  async createVersion(
    contentId: string,
    dto: CreateVersionDto,
    user: User,
  ): Promise<Record<string, unknown>> {
    const content = await this.em.findOne(Content, { id: contentId, deletedAt: null });
    if (!content) {
      throw new NotFoundException('Content not found');
    }

    const typeData = await this.loadTypeData(content);

    // Get max version number
    const existingVersions = await this.em.find(
      ContentVersion,
      { content: { id: contentId } },
      { orderBy: { versionNumber: 'DESC' }, limit: 1 },
    );

    const versionNumber = existingVersions.length > 0
      ? existingVersions[0].versionNumber + 1
      : 1;

    // Create snapshot
    const dataSnapshot = {
      contentType: content.contentType,
      status: content.status,
      slug: content.slug,
      locale: content.locale,
      version: content.version,
      ...typeData,
    };

    const version = this.em.create(ContentVersion, {
      content,
      versionNumber,
      dataSnapshot,
      changeSummary: dto.changeSummary,
      createdBy: user,
    });

    await this.em.persistAndFlush(version);

    return this.serializeVersion(version);
  }

  async restoreVersion(
    contentId: string,
    versionId: string,
    user: User,
  ): Promise<Record<string, unknown>> {
    const content = await this.em.findOne(
      Content,
      { id: contentId, deletedAt: null },
      { populate: ['createdBy', 'updatedBy', 'tags'] },
    );
    if (!content) {
      throw new NotFoundException('Content not found');
    }

    const version = await this.em.findOne(ContentVersion, {
      id: versionId,
      content: { id: contentId },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    // First, create backup of current state
    const currentTypeData = await this.loadTypeData(content);
    await this.createVersion(
      contentId,
      { changeSummary: `Backup before restore to version ${version.versionNumber}` },
      user,
    );

    // Restore from snapshot
    const snapshot = version.dataSnapshot;

    // Update content fields
    content.slug = snapshot.slug as string;
    content.locale = snapshot.locale as string;
    content.status = snapshot.status as any;
    content.version += 1;
    content.updatedBy = user;

    // Update type-specific data
    if (content.contentType === ContentType.BLOG) {
      const blog = await this.em.findOne(Blog, { content: { id: contentId } });
      if (blog) {
        blog.title = snapshot.title as string;
        blog.excerpt = snapshot.excerpt as string;
        blog.body = snapshot.body as string;
        blog.isFeatured = snapshot.isFeatured as boolean;
        blog.seoTitle = snapshot.seoTitle as string;
        blog.seoDescription = snapshot.seoDescription as string;
        blog.seoKeywords = snapshot.seoKeywords as string;
      }
    }

    if (content.contentType === ContentType.PRODUCT) {
      const product = await this.em.findOne(Product, { content: { id: contentId } });
      if (product) {
        product.name = snapshot.name as string;
        product.description = snapshot.description as string;
        product.shortDescription = snapshot.shortDescription as string;
        product.sku = snapshot.sku as string;
        product.price = snapshot.price?.toString();
        product.compareAtPrice = snapshot.compareAtPrice?.toString();
        product.currency = (snapshot.currency as string) || 'USD';
        product.stockQuantity = (snapshot.stockQuantity as number) || 0;
        product.isFeatured = snapshot.isFeatured as boolean;
        product.attributes = (snapshot.attributes as Record<string, unknown>) || {};
        product.seoTitle = snapshot.seoTitle as string;
        product.seoDescription = snapshot.seoDescription as string;
        product.seoKeywords = snapshot.seoKeywords as string;
      }
    }

    await this.em.flush();

    const typeData = await this.loadTypeData(content);
    return this.serializeContent(content, typeData);
  }

  private async loadTypeData(content: Content): Promise<Record<string, unknown>> {
    if (content.contentType === ContentType.BLOG) {
      const blog = await this.em.findOne(Blog, { content: { id: content.id } });
      if (blog) {
        return {
          title: blog.title,
          excerpt: blog.excerpt,
          body: blog.body,
          featuredImageId: blog.featuredImageId,
          readingTimeMinutes: blog.readingTimeMinutes,
          isFeatured: blog.isFeatured,
          seoTitle: blog.seoTitle,
          seoDescription: blog.seoDescription,
          seoKeywords: blog.seoKeywords,
        };
      }
    }

    if (content.contentType === ContentType.PRODUCT) {
      const product = await this.em.findOne(Product, { content: { id: content.id } });
      if (product) {
        return {
          name: product.name,
          description: product.description,
          shortDescription: product.shortDescription,
          sku: product.sku,
          price: product.price ? parseFloat(product.price) : null,
          compareAtPrice: product.compareAtPrice ? parseFloat(product.compareAtPrice) : null,
          currency: product.currency,
          stockQuantity: product.stockQuantity,
          isFeatured: product.isFeatured,
          attributes: product.attributes,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
          seoKeywords: product.seoKeywords,
        };
      }
    }

    return {};
  }

  private serializeContent(
    content: Content,
    typeData: Record<string, unknown>,
  ): Record<string, unknown> {
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
      typeData,
    };
  }

  private serializeVersion(version: ContentVersion): Record<string, unknown> {
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      dataSnapshot: version.dataSnapshot,
      changeSummary: version.changeSummary,
      createdBy: version.createdBy
        ? {
            id: version.createdBy.id,
            email: version.createdBy.email,
            firstName: version.createdBy.firstName,
            lastName: version.createdBy.lastName,
          }
        : null,
      createdAt: version.createdAt.toISOString(),
    };
  }
}
