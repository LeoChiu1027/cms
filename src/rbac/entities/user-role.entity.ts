import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
  OptionalProps,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { User } from '../../auth/entities/user.entity';
import { Role } from './role.entity';

@Entity({ tableName: 'user_roles' })
@Unique({ properties: ['user', 'role'], name: 'idx_user_roles_unique' })
export class UserRole {
  [OptionalProps]?: 'id' | 'createdAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => User, { deleteRule: 'cascade' })
  user!: User;

  @ManyToOne(() => Role, { deleteRule: 'cascade' })
  role!: Role;

  @ManyToOne(() => User, { nullable: true })
  assignedBy?: User;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();
}
