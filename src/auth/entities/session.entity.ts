import {
  Entity,
  PrimaryKey,
  Property,
  Index,
  Unique,
  ManyToOne,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { User } from './user.entity';

@Entity({ tableName: 'sessions' })
export class Session {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => User)
  @Index({ name: 'idx_sessions_user' })
  user!: User;

  @Property({ length: 255 })
  @Unique()
  @Index({ name: 'idx_sessions_token' })
  tokenHash!: string;

  @Property({ length: 45, nullable: true })
  ipAddress?: string;

  @Property({ length: 500, nullable: true })
  userAgent?: string;

  @Property()
  @Index({ name: 'idx_sessions_expires' })
  expiresAt!: Date;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();
}
