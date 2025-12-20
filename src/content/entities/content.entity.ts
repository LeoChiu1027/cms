import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  ManyToOne,
  OneToOne,
  OneToMany,
  ManyToMany,
  Collection,
  OptionalProps,
  Index,
  Unique,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { User } from '../../auth/entities/user.entity';
import { ContentType } from '../enums/content-type.enum';
import { ContentStatus } from '../enums/content-status.enum';
import { Tag } from './tag.entity';
import { ContentTag } from './content-tag.entity';
import { ContentVersion } from './content-version.entity';

@Entity({ tableName: 'contents' })
@Unique({ properties: ['slug', 'locale'] })
@Index({ properties: ['contentType'] })
@Index({ properties: ['status'] })
@Index({ properties: ['contentType', 'status'] })
@Index({ properties: ['contentType', 'status', 'isLatest'] })
export class Content {
  [OptionalProps]?:
    | 'id'
    | 'status'
    | 'locale'
    | 'version'
    | 'isLatest'
    | 'createdAt'
    | 'updatedAt'
    | 'tags'
    | 'contentTags'
    | 'versions';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Enum(() => ContentType)
  contentType!: ContentType;

  @Enum(() => ContentStatus)
  status: ContentStatus = ContentStatus.DRAFT;

  @Property({ length: 255 })
  @Index()
  slug!: string;

  @Property({ length: 10, default: 'en' })
  locale: string = 'en';

  @Property({ default: 1 })
  version: number = 1;

  @Property({ default: true })
  isLatest: boolean = true;

  @Property({ type: 'timestamp', nullable: true })
  @Index()
  publishedAt?: Date;

  @Property({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @ManyToOne(() => User)
  createdBy!: User;

  @ManyToOne(() => User, { nullable: true })
  updatedBy?: User;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  // Relations
  @ManyToMany(() => Tag, (tag) => tag.contents, {
    owner: true,
    pivotEntity: () => ContentTag,
  })
  tags = new Collection<Tag>(this);

  @OneToMany(() => ContentTag, (ct) => ct.content)
  contentTags = new Collection<ContentTag>(this);

  @OneToMany(() => ContentVersion, (cv) => cv.content)
  versions = new Collection<ContentVersion>(this);
}
