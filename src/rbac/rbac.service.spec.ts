import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from '@mikro-orm/postgresql';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { User } from '../auth/entities/user.entity';

describe('RbacService', () => {
  let service: RbacService;
  let em: jest.Mocked<EntityManager>;

  const mockRole = {
    id: 'role-1',
    name: 'Test Role',
    slug: 'test-role',
    description: 'Test description',
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: { getItems: () => [], contains: () => false, add: jest.fn() },
  };

  const mockPermission = {
    id: 'permission-1',
    name: 'Test Permission',
    slug: 'test:permission',
    resource: 'test',
    action: 'read',
    description: 'Test permission',
    createdAt: new Date(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeEach(async () => {
    const mockEm = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      persist: jest.fn(),
      persistAndFlush: jest.fn(),
      flush: jest.fn(),
      removeAndFlush: jest.fn(),
      refresh: jest.fn(),
      assign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: EntityManager,
          useValue: mockEm,
        },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
    em = module.get(EntityManager);
  });

  describe('createRole', () => {
    it('should create a role with valid data', async () => {
      // Arrange
      const dto = { name: 'New Role', slug: 'new-role', description: 'Description' };
      em.findOne.mockResolvedValue(null);
      em.create.mockReturnValue(mockRole);

      // Act
      const result = await service.createRole(dto);

      // Assert
      expect(em.findOne).toHaveBeenCalledWith(Role, { slug: dto.slug });
      expect(em.create).toHaveBeenCalledWith(
        Role,
        expect.objectContaining({
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
        }),
      );
      expect(em.persistAndFlush).toHaveBeenCalled();
      expect(result).toEqual(mockRole);
    });

    it('should throw ConflictException when slug already exists', async () => {
      // Arrange
      const dto = { name: 'New Role', slug: 'existing-role' };
      em.findOne.mockResolvedValue(mockRole);

      // Act & Assert
      await expect(service.createRole(dto)).rejects.toThrow(ConflictException);
      expect(em.findOne).toHaveBeenCalledWith(Role, { slug: dto.slug });
      expect(em.create).not.toHaveBeenCalled();
    });
  });

  describe('getRole', () => {
    it('should return role with permissions when found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockRole);

      // Act
      const result = await service.getRole('role-1');

      // Assert
      expect(em.findOne).toHaveBeenCalledWith(
        Role,
        { id: 'role-1' },
        { populate: ['permissions'] },
      );
      expect(result).toEqual(mockRole);
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getRole('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listRoles', () => {
    it('should return paginated roles', async () => {
      // Arrange
      const roles = [mockRole];
      em.findAndCount.mockResolvedValue([roles, 1]);

      // Act
      const result = await service.listRoles();

      // Assert
      expect(result).toEqual({
        data: roles,
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('should filter by isSystem when provided', async () => {
      // Arrange
      em.findAndCount.mockResolvedValue([[mockRole], 1]);

      // Act
      await service.listRoles({ isSystem: false });

      // Assert
      expect(em.findAndCount).toHaveBeenCalledWith(
        Role,
        { isSystem: false },
        expect.any(Object),
      );
    });
  });

  describe('updateRole', () => {
    it('should update role with valid data', async () => {
      // Arrange
      const dto = { name: 'Updated Name' };
      const updatedRole = { ...mockRole, isSystem: false };
      em.findOne.mockResolvedValue(updatedRole);

      // Act
      const result = await service.updateRole('role-1', dto);

      // Assert
      expect(em.findOne).toHaveBeenCalledWith(Role, { id: 'role-1' });
      expect(em.flush).toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateRole('non-existent', {})).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating system role', async () => {
      // Arrange
      em.findOne.mockResolvedValue({ ...mockRole, isSystem: true });

      // Act & Assert
      await expect(service.updateRole('role-1', { name: 'New Name' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteRole', () => {
    it('should delete non-system role', async () => {
      // Arrange
      em.findOne.mockResolvedValue({ ...mockRole, isSystem: false });

      // Act
      await service.deleteRole('role-1');

      // Assert
      expect(em.removeAndFlush).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when deleting system role', async () => {
      // Arrange
      em.findOne.mockResolvedValue({ ...mockRole, isSystem: true });

      // Act & Assert
      await expect(service.deleteRole('role-1')).rejects.toThrow(ForbiddenException);
      expect(em.removeAndFlush).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteRole('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPermission', () => {
    it('should create a permission with valid data', async () => {
      // Arrange
      const dto = {
        name: 'New Permission',
        slug: 'new:permission',
        resource: 'test',
        action: 'create',
      };
      em.findOne.mockResolvedValue(null);
      em.create.mockReturnValue(mockPermission);

      // Act
      const result = await service.createPermission(dto);

      // Assert
      expect(em.findOne).toHaveBeenCalledWith(Permission, { slug: dto.slug });
      expect(em.create).toHaveBeenCalledWith(Permission, dto);
      expect(em.persistAndFlush).toHaveBeenCalled();
    });

    it('should throw ConflictException when slug already exists', async () => {
      // Arrange
      const dto = { name: 'Permission', slug: 'existing:permission', resource: 'test', action: 'read' };
      em.findOne.mockResolvedValue(mockPermission);

      // Act & Assert
      await expect(service.createPermission(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getPermission', () => {
    it('should return permission when found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockPermission);

      // Act
      const result = await service.getPermission('permission-1');

      // Assert
      expect(result).toEqual(mockPermission);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getPermission('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePermission', () => {
    it('should delete permission when found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockPermission);

      // Act
      await service.deletePermission('permission-1');

      // Assert
      expect(em.removeAndFlush).toHaveBeenCalledWith(mockPermission);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deletePermission('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for role', async () => {
      // Arrange
      const roleWithPermissions = {
        ...mockRole,
        permissions: { getItems: () => [mockPermission] },
      };
      em.findOne.mockResolvedValue(roleWithPermissions);

      // Act
      const result = await service.getRolePermissions('role-1');

      // Assert
      expect(result).toEqual([mockPermission]);
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getRolePermissions('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignPermissionsToRole', () => {
    it('should assign permissions to role', async () => {
      // Arrange
      const roleWithPermissions = {
        ...mockRole,
        permissions: { getItems: () => [], contains: () => false, add: jest.fn() },
      };
      em.findOne.mockResolvedValue(roleWithPermissions);
      em.find.mockResolvedValueOnce([mockPermission]).mockResolvedValueOnce([]);

      // Act
      await service.assignPermissionsToRole('role-1', ['permission-1']);

      // Assert
      expect(em.persist).toHaveBeenCalled();
      expect(em.flush).toHaveBeenCalled();
    });

    it('should throw BadRequestException when permission ID is invalid', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockRole);
      em.find.mockResolvedValue([]);

      // Act & Assert
      await expect(
        service.assignPermissionsToRole('role-1', ['invalid-id']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assignPermissionsToRole('non-existent', ['permission-1']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserRoles', () => {
    it('should return roles for user', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockUser);
      em.find.mockResolvedValue([{ role: mockRole }]);

      // Act
      const result = await service.getUserRoles('user-1');

      // Assert
      expect(result).toEqual([mockRole]);
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserRoles('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignRolesToUser', () => {
    it('should assign roles to user', async () => {
      // Arrange
      // First findOne for user validation, second for assignedBy, third for getUserRoles
      em.findOne.mockResolvedValue(mockUser);
      // First find for roles validation, second for existing userRoles, third for getUserRoles return
      em.find
        .mockResolvedValueOnce([mockRole]) // validate roles exist
        .mockResolvedValueOnce([]) // existing user roles (empty)
        .mockResolvedValueOnce([{ role: mockRole }]); // getUserRoles result

      // Act
      const result = await service.assignRolesToUser('user-1', ['role-1'], 'admin-id');

      // Assert
      expect(em.persist).toHaveBeenCalled();
      expect(em.flush).toHaveBeenCalled();
      expect(result).toEqual([mockRole]);
    });

    it('should throw BadRequestException when role ID is invalid', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockUser);
      em.find.mockResolvedValue([]);

      // Act & Assert
      await expect(
        service.assignRolesToUser('user-1', ['invalid-id']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assignRolesToUser('non-existent', ['role-1']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('userHasPermission', () => {
    it('should return true when user has permission', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockUser);
      em.find.mockResolvedValue([
        { role: { permissions: { getItems: () => [{ slug: 'test:permission' }] } } },
      ]);

      // Act
      const result = await service.userHasPermission('user-1', 'test:permission');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when user does not have permission', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockUser);
      em.find.mockResolvedValue([
        { role: { permissions: { getItems: () => [{ slug: 'other:permission' }] } } },
      ]);

      // Act
      const result = await service.userHasPermission('user-1', 'test:permission');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('userHasRole', () => {
    it('should return true when user has role', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockUser);
      em.find.mockResolvedValue([{ role: { slug: 'test-role' } }]);

      // Act
      const result = await service.userHasRole('user-1', 'test-role');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when user does not have role', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockUser);
      em.find.mockResolvedValue([{ role: { slug: 'other-role' } }]);

      // Act
      const result = await service.userHasRole('user-1', 'test-role');

      // Assert
      expect(result).toBe(false);
    });
  });
});
