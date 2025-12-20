import {
  Entity,
  PrimaryKey,
  Property,
  Collection,
  ManyToMany,
  OptionalProps,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';

@Entity({ tableName: 'tags' })
export class Tag {
  [OptionalProps]?: 'id' | 'createdAt' | 'contents';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ length: 100, unique: true })
  name!: string;

  @Property({ length: 100, unique: true })
  slug!: string;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  // Inverse side of the Content-Tag many-to-many relation
  @ManyToMany(() => require('./content.entity').Content, 'tags')
  contents = new Collection<any>(this);
}
