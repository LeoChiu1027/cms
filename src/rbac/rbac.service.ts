import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { User } from '../auth/entities/user.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';

interface PaginationOptions {
  page?: number;
  limit?: number;
}

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class RbacService {
  constructor(private readonly em: EntityManager) {}

  // =========================================
  // ROLES
  // =========================================

  async createRole(dto: CreateRoleDto): Promise<Role> {
    // Check if slug already exists
    const existing = await this.em.findOne(Role, { slug: dto.slug });
    if (existing) {
      throw new ConflictException('Role with this slug already exists');
    }

    const role = this.em.create(Role, {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      isSystem: false,
    });

    await this.em.persistAndFlush(role);
    return role;
  }

  async listRoles(
    options: PaginationOptions & { isSystem?: boolean } = {},
  ): Promise<PaginatedResult<Role>> {
    const { page = 1, limit = 20, isSystem } = options;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (isSystem !== undefined) {
      where.isSystem = isSystem;
    }

    const [roles, total] = await this.em.findAndCount(Role, where, {
      limit,
      offset,
      orderBy: { createdAt: 'DESC' },
    });

    return {
      data: roles,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRole(id: string): Promise<Role> {
    const role = await this.em.findOne(
      Role,
      { id },
      { populate: ['permissions'] },
    );
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.em.findOne(Role, { id });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new ForbiddenException('Cannot modify system roles');
    }

    if (dto.name !== undefined) {
      role.name = dto.name;
    }
    if (dto.description !== undefined) {
      role.description = dto.description;
    }

    await this.em.flush();
    return role;
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.em.findOne(Role, { id });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete system roles');
    }

    await this.em.removeAndFlush(role);
  }

  // =========================================
  // PERMISSIONS
  // =========================================

  async createPermission(dto: CreatePermissionDto): Promise<Permission> {
    // Check if slug already exists
    const existing = await this.em.findOne(Permission, { slug: dto.slug });
    if (existing) {
      throw new ConflictException('Permission with this slug already exists');
    }

    const permission = this.em.create(Permission, {
      name: dto.name,
      slug: dto.slug,
      resource: dto.resource,
      action: dto.action,
      description: dto.description,
    });

    await this.em.persistAndFlush(permission);
    return permission;
  }

  async listPermissions(
    options: PaginationOptions & { resource?: string; action?: string } = {},
  ): Promise<PaginatedResult<Permission>> {
    const { page = 1, limit = 20, resource, action } = options;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (resource) {
      where.resource = resource;
    }
    if (action) {
      where.action = action;
    }

    const [permissions, total] = await this.em.findAndCount(Permission, where, {
      limit,
      offset,
      orderBy: { createdAt: 'DESC' },
    });

    return {
      data: permissions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPermission(id: string): Promise<Permission> {
    const permission = await this.em.findOne(Permission, { id });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  async deletePermission(id: string): Promise<void> {
    const permission = await this.em.findOne(Permission, { id });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    await this.em.removeAndFlush(permission);
  }

  // =========================================
  // ROLE PERMISSIONS
  // =========================================

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const role = await this.em.findOne(
      Role,
      { id: roleId },
      { populate: ['permissions'] },
    );
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role.permissions.getItems();
  }

  async assignPermissionsToRole(
    roleId: string,
    permissionIds: string[],
  ): Promise<Role> {
    const role = await this.em.findOne(
      Role,
      { id: roleId },
      { populate: ['permissions'] },
    );
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Validate all permission IDs exist
    const permissions = await this.em.find(Permission, {
      id: { $in: permissionIds },
    });
    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permission IDs are invalid');
    }

    // Get existing role permissions to avoid duplicates
    const existingRolePermissions = await this.em.find(RolePermission, {
      role: role,
      permission: { $in: permissions },
    });
    const existingPermissionIds = new Set(
      existingRolePermissions.map((rp) => rp.permission.id),
    );

    // Create RolePermission entities directly for new permissions
    for (const permission of permissions) {
      if (!existingPermissionIds.has(permission.id)) {
        const rolePermission = new RolePermission();
        rolePermission.role = role;
        rolePermission.permission = permission;
        this.em.persist(rolePermission);
      }
    }

    await this.em.flush();

    // Reload role with permissions
    await this.em.refresh(role, { populate: ['permissions'] });
    return role;
  }

  async removePermissionsFromRole(
    roleId: string,
    permissionIds: string[],
  ): Promise<Role> {
    const role = await this.em.findOne(
      Role,
      { id: roleId },
      { populate: ['permissions'] },
    );
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Find and remove RolePermission entities directly
    const rolePermissionsToRemove = await this.em.find(RolePermission, {
      role: { id: roleId },
      permission: { id: { $in: permissionIds } },
    });

    await this.em.removeAndFlush(rolePermissionsToRemove);

    // Reload role with permissions
    await this.em.refresh(role, { populate: ['permissions'] });
    return role;
  }

  // =========================================
  // USER ROLES
  // =========================================

  async getUserRoles(userId: string): Promise<Role[]> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRoles = await this.em.find(
      UserRole,
      { user: { id: userId } },
      { populate: ['role'] },
    );

    return userRoles.map((ur) => ur.role);
  }

  async assignRolesToUser(
    userId: string,
    roleIds: string[],
    assignedById?: string,
  ): Promise<Role[]> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate all role IDs exist
    const roles = await this.em.find(Role, { id: { $in: roleIds } });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more role IDs are invalid');
    }

    // Get existing user roles
    const existingUserRoles = await this.em.find(UserRole, {
      user: { id: userId },
    });
    const existingRoleIds = new Set(existingUserRoles.map((ur) => ur.role.id));

    // Add new roles (avoiding duplicates)
    const assignedBy = assignedById
      ? await this.em.findOne(User, { id: assignedById })
      : undefined;

    for (const role of roles) {
      if (!existingRoleIds.has(role.id)) {
        const userRole = new UserRole();
        userRole.user = user;
        userRole.role = role;
        if (assignedBy) {
          userRole.assignedBy = assignedBy;
        }
        this.em.persist(userRole);
      }
    }

    await this.em.flush();
    return this.getUserRoles(userId);
  }

  async removeRolesFromUser(userId: string, roleIds: string[]): Promise<Role[]> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find and remove user roles
    const userRolesToRemove = await this.em.find(UserRole, {
      user: { id: userId },
      role: { id: { $in: roleIds } },
    });

    await this.em.removeAndFlush(userRolesToRemove);
    return this.getUserRoles(userId);
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get all user roles with their permissions
    const userRoles = await this.em.find(
      UserRole,
      { user: { id: userId } },
      { populate: ['role.permissions'] },
    );

    // Collect unique permissions
    const permissionMap = new Map<string, Permission>();
    for (const userRole of userRoles) {
      for (const permission of userRole.role.permissions.getItems()) {
        permissionMap.set(permission.id, permission);
      }
    }

    return Array.from(permissionMap.values());
  }

  // =========================================
  // PERMISSION CHECKING (for guards)
  // =========================================

  async userHasPermission(userId: string, permissionSlug: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.some((p) => p.slug === permissionSlug);
  }

  async userHasAnyPermission(
    userId: string,
    permissionSlugs: string[],
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.some((p) => permissionSlugs.includes(p.slug));
  }

  async userHasAllPermissions(
    userId: string,
    permissionSlugs: string[],
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    const userPermissionSlugs = new Set(permissions.map((p) => p.slug));
    return permissionSlugs.every((slug) => userPermissionSlugs.has(slug));
  }

  async userHasRole(userId: string, roleSlug: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.some((r) => r.slug === roleSlug);
  }

  async userHasAnyRole(userId: string, roleSlugs: string[]): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.some((r) => roleSlugs.includes(r.slug));
  }
}
