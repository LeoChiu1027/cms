import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly em: EntityManager) {}

  async create(dto: CreateTagDto): Promise<Tag> {
    // Check for existing slug
    const existingSlug = await this.em.findOne(Tag, { slug: dto.slug });
    if (existingSlug) {
      throw new ConflictException('Tag with this slug already exists');
    }

    // Check for existing name
    const existingName = await this.em.findOne(Tag, { name: dto.name });
    if (existingName) {
      throw new ConflictException('Tag with this name already exists');
    }

    const tag = this.em.create(Tag, {
      name: dto.name,
      slug: dto.slug,
    });

    await this.em.persistAndFlush(tag);
    return tag;
  }

  async findAll(
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ data: Tag[]; total: number }> {
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.name = { $ilike: `%${search}%` };
    }

    const [data, total] = await this.em.findAndCount(Tag, where, {
      limit,
      offset,
      orderBy: { createdAt: 'DESC' },
    });

    return { data, total };
  }

  async findOne(id: string): Promise<Tag> {
    const tag = await this.em.findOne(Tag, { id });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return tag;
  }

  async remove(id: string): Promise<void> {
    const tag = await this.em.findOne(Tag, { id });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.em.removeAndFlush(tag);
  }
}
