import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RbacService } from './rbac.service';

describe('RolesController', () => {
  let controller: RolesController;
  let rbacService: jest.Mocked<RbacService>;

  const mockRole = {
    id: 'role-1',
    name: 'Test Role',
    slug: 'test-role',
    description: 'Test description',
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: { getItems: () => [] },
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

  beforeEach(async () => {
    const mockRbacService = {
      createRole: jest.fn(),
      listRoles: jest.fn(),
      getRole: jest.fn(),
      updateRole: jest.fn(),
      deleteRole: jest.fn(),
      getRolePermissions: jest.fn(),
      assignPermissionsToRole: jest.fn(),
      removePermissionsFromRole: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
      ],
    }).compile();

    controller = module.get<RolesController>(RolesController);
    rbacService = module.get(RbacService);
  });

  describe('create', () => {
    it('should create a role and return serialized response', async () => {
      // Arrange
      const dto = { name: 'New Role', slug: 'new-role' };
      rbacService.createRole.mockResolvedValue(mockRole as any);

      // Act
      const result = await controller.create(dto);

      // Assert
      expect(rbacService.createRole).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({
        id: mockRole.id,
        name: mockRole.name,
        slug: mockRole.slug,
      });
    });

    it('should propagate ConflictException from service', async () => {
      // Arrange
      const dto = { name: 'New Role', slug: 'existing-role' };
      rbacService.createRole.mockRejectedValue(new ConflictException());

      // Act & Assert
      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('list', () => {
    it('should return paginated roles', async () => {
      // Arrange
      const paginatedResult = {
        data: [mockRole],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      rbacService.listRoles.mockResolvedValue(paginatedResult as any);

      // Act
      const result = await controller.list();

      // Assert
      expect(rbacService.listRoles).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual(paginatedResult.meta);
    });

    it('should pass query parameters to service', async () => {
      // Arrange
      rbacService.listRoles.mockResolvedValue({ data: [], meta: {} } as any);

      // Act
      await controller.list('2', '10', 'false');

      // Assert
      expect(rbacService.listRoles).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        isSystem: false,
      });
    });
  });

  describe('get', () => {
    it('should return role with permissions', async () => {
      // Arrange
      rbacService.getRole.mockResolvedValue(mockRole as any);

      // Act
      const result = await controller.get('role-1');

      // Assert
      expect(rbacService.getRole).toHaveBeenCalledWith('role-1');
      expect(result.id).toBe(mockRole.id);
      expect(result.permissions).toBeDefined();
    });

    it('should propagate NotFoundException from service', async () => {
      // Arrange
      rbacService.getRole.mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(controller.get('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update role and return serialized response', async () => {
      // Arrange
      const dto = { name: 'Updated Name' };
      rbacService.updateRole.mockResolvedValue({ ...mockRole, name: 'Updated Name' } as any);

      // Act
      const result = await controller.update('role-1', dto);

      // Assert
      expect(rbacService.updateRole).toHaveBeenCalledWith('role-1', dto);
      expect(result.name).toBe('Updated Name');
    });

    it('should propagate NotFoundException from service', async () => {
      // Arrange
      rbacService.updateRole.mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(controller.update('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete role', async () => {
      // Arrange
      rbacService.deleteRole.mockResolvedValue(undefined);

      // Act
      await controller.delete('role-1');

      // Assert
      expect(rbacService.deleteRole).toHaveBeenCalledWith('role-1');
    });

    it('should propagate NotFoundException from service', async () => {
      // Arrange
      rbacService.deleteRole.mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(controller.delete('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException for system roles', async () => {
      // Arrange
      rbacService.deleteRole.mockRejectedValue(new BadRequestException());

      // Act & Assert
      await expect(controller.delete('system-role')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPermissions', () => {
    it('should return role permissions', async () => {
      // Arrange
      rbacService.getRolePermissions.mockResolvedValue([mockPermission] as any);

      // Act
      const result = await controller.getPermissions('role-1');

      // Assert
      expect(rbacService.getRolePermissions).toHaveBeenCalledWith('role-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockPermission.id);
    });
  });

  describe('assignPermissions', () => {
    it('should assign permissions to role', async () => {
      // Arrange
      const roleWithPermissions = {
        ...mockRole,
        permissions: { getItems: () => [mockPermission] },
      };
      rbacService.assignPermissionsToRole.mockResolvedValue(roleWithPermissions as any);

      // Act
      const result = await controller.assignPermissions('role-1', {
        permissionIds: ['permission-1'],
      });

      // Assert
      expect(rbacService.assignPermissionsToRole).toHaveBeenCalledWith('role-1', ['permission-1']);
      expect(result.permissions).toHaveLength(1);
    });

    it('should propagate BadRequestException for invalid permission IDs', async () => {
      // Arrange
      rbacService.assignPermissionsToRole.mockRejectedValue(new BadRequestException());

      // Act & Assert
      await expect(
        controller.assignPermissions('role-1', { permissionIds: ['invalid'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removePermissions', () => {
    it('should remove permissions from role', async () => {
      // Arrange
      const roleWithoutPermissions = {
        ...mockRole,
        permissions: { getItems: () => [] },
      };
      rbacService.removePermissionsFromRole.mockResolvedValue(roleWithoutPermissions as any);

      // Act
      const result = await controller.removePermissions('role-1', {
        permissionIds: ['permission-1'],
      });

      // Assert
      expect(rbacService.removePermissionsFromRole).toHaveBeenCalledWith('role-1', ['permission-1']);
      expect(result.permissions).toHaveLength(0);
    });
  });
});
