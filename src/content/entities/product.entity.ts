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

@Entity({ tableName: 'products' })
export class Product {
  [OptionalProps]?:
    | 'id'
    | 'currency'
    | 'stockQuantity'
    | 'isFeatured'
    | 'attributes';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @OneToOne(() => Content, { owner: true, unique: true })
  content!: Content;

  @Property({ length: 255 })
  @Index()
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ length: 500, nullable: true })
  shortDescription?: string;

  @Property({ length: 100, nullable: true, unique: true })
  @Index()
  sku?: string;

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  @Index()
  price?: string;

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  compareAtPrice?: string;

  @Property({ length: 3, default: 'USD' })
  currency: string = 'USD';

  @Property({ type: 'int', default: 0 })
  stockQuantity: number = 0;

  @Property({ default: false })
  @Index()
  isFeatured: boolean = false;

  @Property({ type: 'jsonb', default: '{}' })
  attributes: Record<string, unknown> = {};

  @Property({ length: 255, nullable: true })
  seoTitle?: string;

  @Property({ length: 500, nullable: true })
  seoDescription?: string;

  @Property({ length: 255, nullable: true })
  seoKeywords?: string;
}
