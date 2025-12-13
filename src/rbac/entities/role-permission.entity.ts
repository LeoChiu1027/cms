import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
  OptionalProps,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Entity({ tableName: 'role_permissions' })
@Unique({ properties: ['role', 'permission'], name: 'idx_role_permissions_unique' })
export class RolePermission {
  [OptionalProps]?: 'id' | 'createdAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => Role, { deleteRule: 'cascade' })
  role!: Role;

  @ManyToOne(() => Permission, { deleteRule: 'cascade' })
  permission!: Permission;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();
}
