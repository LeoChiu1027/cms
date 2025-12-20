import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
  OptionalProps,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Content } from './content.entity';
import { Tag } from './tag.entity';

@Entity({ tableName: 'content_tags' })
@Unique({ properties: ['content', 'tag'] })
export class ContentTag {
  [OptionalProps]?: 'id' | 'createdAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => Content)
  content!: Content;

  @ManyToOne(() => Tag)
  tag!: Tag;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();
}
