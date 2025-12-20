import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
  OptionalProps,
  Index,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Content } from './content.entity';
import { User } from '../../auth/entities/user.entity';

@Entity({ tableName: 'content_versions' })
@Unique({ properties: ['content', 'versionNumber'] })
export class ContentVersion {
  [OptionalProps]?: 'id' | 'createdAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => Content)
  @Index()
  content!: Content;

  @Property()
  versionNumber!: number;

  @Property({ type: 'jsonb' })
  dataSnapshot!: Record<string, unknown>;

  @Property({ length: 500, nullable: true })
  changeSummary?: string;

  @ManyToOne(() => User)
  createdBy!: User;

  @Property({ onCreate: () => new Date() })
  @Index()
  createdAt: Date = new Date();
}
