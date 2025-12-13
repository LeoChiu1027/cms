import {
  Entity,
  PrimaryKey,
  Property,
  Collection,
  ManyToMany,
  OneToMany,
  Index,
  OptionalProps,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Role } from './role.entity';
import { RolePermission } from './role-permission.entity';

@Entity({ tableName: 'permissions' })
export class Permission {
  [OptionalProps]?:
    | 'id'
    | 'createdAt'
    | 'roles'
    | 'rolePermissions';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ length: 100 })
  name!: string;

  @Property({ length: 100, unique: true })
  slug!: string;

  @Property({ length: 50 })
  @Index({ name: 'idx_permissions_resource' })
  resource!: string;

  @Property({ length: 50 })
  action!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @ManyToMany(() => Role, (role) => role.permissions)
  roles = new Collection<Role>(this);

  @OneToMany(() => RolePermission, (rp) => rp.permission)
  rolePermissions = new Collection<RolePermission>(this);
}
