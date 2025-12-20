import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Content } from './entities/content.entity';
import { Blog } from './entities/blog.entity';
import { Tag } from './entities/tag.entity';
import { ContentTag } from './entities/content-tag.entity';
import { ContentVersion } from './entities/content-version.entity';
import { ContentType } from './enums/content-type.enum';
import { ContentStatus } from './enums/content-status.enum';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class BlogsService {
  constructor(private readonly em: EntityManager) {}

  async create(dto: CreateBlogDto, user: User): Promise<Record<string, unknown>> {
    // Check for existing slug
    const existingSlug = await this.em.findOne(Content, {
      slug: dto.slug,
      locale: dto.locale || 'en',
      deletedAt: null,
    });
    if (existingSlug) {
      throw new ConflictException('Blog with this slug already exists');
    }

    // Create content
    const content = this.em.create(Content, {
      contentType: ContentType.BLOG,
      status: ContentStatus.DRAFT,
      slug: dto.slug,
      locale: dto.locale || 'en',
      createdBy: user,
    });

    // Create blog
    const blog = this.em.create(Blog, {
      content,
      title: dto.title,
      body: dto.body,
      excerpt: dto.excerpt,
      isFeatured: dto.isFeatured || false,
      seoTitle: dto.seoTitle,
      seoDescription: dto.seoDescription,
      seoKeywords: dto.seoKeywords,
    });

    await this.em.persistAndFlush([content, blog]);

    // Add tags if provided
    if (dto.tagIds && dto.tagIds.length > 0) {
      await this.addTagsInternal(content, dto.tagIds);
    }

    // Reload with relations
    await this.em.refresh(content, { populate: ['tags', 'createdBy'] });

    return this.serializeBlog(content, blog);
  }

  async findAll(
    page: number,
    limit: number,
    filters: {
      status?: string;
      isFeatured?: boolean;
      search?: string;
    },
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {
      contentType: ContentType.BLOG,
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

    // Load blogs for each content
    const contentIds = contents.map((c) => c.id);
    const blogs = await this.em.find(Blog, { content: { id: { $in: contentIds } } });
    const blogMap = new Map(blogs.map((b) => [b.content.id, b]));

    // Apply blog-specific filters
    let results: Array<{ content: Content; blog: Blog }> = contents
      .map((content) => {
        const blog = blogMap.get(content.id);
        if (!blog) return null;
        return { content: content as Content, blog };
      })
      .filter((item) => item !== null);

    // Filter by isFeatured
    if (filters.isFeatured !== undefined) {
      results = results.filter((item) => item.blog.isFeatured === filters.isFeatured);
    }

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(
        (item) =>
          item.blog.title.toLowerCase().includes(searchLower) ||
          item.content.slug.toLowerCase().includes(searchLower),
      );
    }

    return {
      data: results.map((item) => this.serializeBlog(item.content, item.blog)),
      total: results.length,
    };
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const content = await this.em.findOne(
      Content,
      { id, contentType: ContentType.BLOG, deletedAt: null },
      { populate: ['createdBy', 'updatedBy', 'tags'] },
    );

    if (!content) {
      throw new NotFoundException('Blog not found');
    }

    const blog = await this.em.findOne(Blog, { content: { id } });
    if (!blog) {
      throw new NotFoundException('Blog data not found');
    }

    return this.serializeBlog(content, blog);
  }

  async update(
    id: string,
    dto: UpdateBlogDto,
    user: User,
  ): Promise<Record<string, unknown>> {
    const content = await this.em.findOne(
      Content,
      { id, contentType: ContentType.BLOG, deletedAt: null },
      { populate: ['createdBy', 'updatedBy', 'tags'] },
    );

    if (!content) {
      throw new NotFoundException('Blog not found');
    }

    const blog = await this.em.findOne(Blog, { content: { id } });
    if (!blog) {
      throw new NotFoundException('Blog data not found');
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
        throw new ConflictException('Blog with this slug already exists');
      }
      content.slug = dto.slug;
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

    // Update blog fields
    if (dto.title !== undefined) blog.title = dto.title;
    if (dto.body !== undefined) blog.body = dto.body;
    if (dto.excerpt !== undefined) blog.excerpt = dto.excerpt;
    if (dto.isFeatured !== undefined) blog.isFeatured = dto.isFeatured;
    if (dto.seoTitle !== undefined) blog.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) blog.seoDescription = dto.seoDescription;
    if (dto.seoKeywords !== undefined) blog.seoKeywords = dto.seoKeywords;

    // Auto-create version on publish
    if (isPublishing) {
      await this.createVersionInternal(content, blog, user, 'Published version');
      content.version += 1;
    }

    await this.em.flush();

    return this.serializeBlog(content, blog);
  }

  async remove(id: string): Promise<void> {
    const content = await this.em.findOne(Content, {
      id,
      contentType: ContentType.BLOG,
      deletedAt: null,
    });

    if (!content) {
      throw new NotFoundException('Blog not found');
    }

    content.deletedAt = new Date();
    await this.em.flush();
  }

  async addTags(id: string, tagIds: string[]): Promise<void> {
    const content = await this.em.findOne(Content, {
      id,
      contentType: ContentType.BLOG,
      deletedAt: null,
    });

    if (!content) {
      throw new NotFoundException('Blog not found');
    }

    await this.addTagsInternal(content, tagIds);
  }

  async removeTags(id: string, tagIds: string[]): Promise<void> {
    const content = await this.em.findOne(Content, {
      id,
      contentType: ContentType.BLOG,
      deletedAt: null,
    });

    if (!content) {
      throw new NotFoundException('Blog not found');
    }

    await this.em.nativeDelete(ContentTag, {
      content: { id },
      tag: { id: { $in: tagIds } },
    });
  }

  async getTags(id: string): Promise<Tag[]> {
    const content = await this.em.findOne(
      Content,
      { id, contentType: ContentType.BLOG, deletedAt: null },
      { populate: ['tags'] },
    );

    if (!content) {
      throw new NotFoundException('Blog not found');
    }

    return content.tags.getItems();
  }

  private async addTagsInternal(content: Content, tagIds: string[]): Promise<void> {
    // Verify tags exist
    const tags = await this.em.find(Tag, { id: { $in: tagIds } });
    if (tags.length !== tagIds.length) {
      throw new NotFoundException('Some tags not found');
    }

    // Get existing content tags
    const existingTags = await this.em.find(ContentTag, {
      content: { id: content.id },
    });
    const existingTagIds = new Set(existingTags.map((ct) => ct.tag.id));

    // Add new tags
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
    blog: Blog,
    user: User,
    changeSummary: string,
  ): Promise<ContentVersion> {
    // Get max version number
    const existingVersions = await this.em.find(
      ContentVersion,
      { content: { id: content.id } },
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
      title: blog.title,
      excerpt: blog.excerpt,
      body: blog.body,
      isFeatured: blog.isFeatured,
      seoTitle: blog.seoTitle,
      seoDescription: blog.seoDescription,
      seoKeywords: blog.seoKeywords,
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

  private serializeBlog(content: Content, blog: Blog): Record<string, unknown> {
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
      // Blog-specific fields
      title: blog.title,
      excerpt: blog.excerpt || null,
      body: blog.body,
      featuredImageId: blog.featuredImageId || null,
      readingTimeMinutes: blog.readingTimeMinutes || null,
      isFeatured: blog.isFeatured,
      seoTitle: blog.seoTitle || null,
      seoDescription: blog.seoDescription || null,
      seoKeywords: blog.seoKeywords || null,
    };
  }
}
