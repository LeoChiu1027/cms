import {
  Entity,
  PrimaryKey,
  Property,
  Index,
  Unique,
  Collection,
  OneToMany,
  OptionalProps,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Session } from './session.entity';
import type { UserRole } from '../../rbac/entities/user-role.entity';

@Entity({ tableName: 'users' })
export class User {
  [OptionalProps]?: 'id' | 'isActive' | 'createdAt' | 'updatedAt' | 'sessions' | 'userRoles';
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ length: 255 })
  @Unique()
  @Index({ name: 'idx_users_email' })
  email!: string;

  @Property({ length: 255, hidden: true })
  passwordHash!: string;

  @Property({ length: 100, nullable: true })
  firstName?: string;

  @Property({ length: 100, nullable: true })
  lastName?: string;

  @Property({ length: 500, nullable: true })
  avatarUrl?: string;

  @Property({ default: true })
  @Index({ name: 'idx_users_active' })
  isActive: boolean = true;

  @Property({ nullable: true })
  emailVerifiedAt?: Date;

  @Property({ nullable: true })
  lastLoginAt?: Date;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ nullable: true })
  deletedAt?: Date;

  @OneToMany(() => Session, (session) => session.user)
  sessions = new Collection<Session>(this);

  @OneToMany('UserRole', 'user')
  userRoles = new Collection<UserRole>(this);
}
