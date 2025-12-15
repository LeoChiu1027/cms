import {
  Entity,
  PrimaryKey,
  Property,
  Collection,
  ManyToMany,
  OneToMany,
  OptionalProps,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Permission } from './permission.entity';
import { RolePermission } from './role-permission.entity';
import { UserRole } from './user-role.entity';

@Entity({ tableName: 'roles' })
export class Role {
  [OptionalProps]?:
    | 'id'
    | 'isSystem'
    | 'createdAt'
    | 'updatedAt'
    | 'permissions'
    | 'rolePermissions'
    | 'userRoles';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ length: 100 })
  name!: string;

  @Property({ length: 100, unique: true })
  slug!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ default: false })
  isSystem: boolean = false;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @ManyToMany(() => Permission, (permission) => permission.roles, {
    owner: true,
    pivotEntity: () => RolePermission,
  })
  permissions = new Collection<Permission>(this);

  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions = new Collection<RolePermission>(this);

  @OneToMany(() => UserRole, (ur) => ur.role)
  userRoles = new Collection<UserRole>(this);
}
