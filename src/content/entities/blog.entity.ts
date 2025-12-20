import {
  Entity,
  PrimaryKey,
  Property,
  OneToOne,
  OptionalProps,
  Index,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Content } from './content.entity';

@Entity({ tableName: 'blogs' })
export class Blog {
  [OptionalProps]?: 'id' | 'isFeatured';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @OneToOne(() => Content, { owner: true, unique: true })
  content!: Content;

  @Property({ length: 255 })
  @Index()
  title!: string;

  @Property({ type: 'text', nullable: true })
  excerpt?: string;

  @Property({ type: 'text' })
  body!: string;

  @Property({ type: 'uuid', nullable: true })
  featuredImageId?: string;

  @Property({ type: 'int', nullable: true })
  readingTimeMinutes?: number;

  @Property({ default: false })
  @Index()
  isFeatured: boolean = false;

  @Property({ length: 255, nullable: true })
  seoTitle?: string;

  @Property({ length: 500, nullable: true })
  seoDescription?: string;

  @Property({ length: 255, nullable: true })
  seoKeywords?: string;
}
