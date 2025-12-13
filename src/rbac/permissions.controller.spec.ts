import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { RbacService } from './rbac.service';

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let rbacService: jest.Mocked<RbacService>;

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
      createPermission: jest.fn(),
      listPermissions: jest.fn(),
      getPermission: jest.fn(),
      deletePermission: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
      ],
    }).compile();

    controller = module.get<PermissionsController>(PermissionsController);
    rbacService = module.get(RbacService);
  });

  describe('create', () => {
    it('should create a permission and return serialized response', async () => {
      // Arrange
      const dto = {
        name: 'New Permission',
        slug: 'new:permission',
        resource: 'test',
        action: 'create',
      };
      rbacService.createPermission.mockResolvedValue(mockPermission as any);

      // Act
      const result = await controller.create(dto);

      // Assert
      expect(rbacService.createPermission).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({
        id: mockPermission.id,
        name: mockPermission.name,
        slug: mockPermission.slug,
        resource: mockPermission.resource,
        action: mockPermission.action,
      });
    });

    it('should propagate ConflictException from service', async () => {
      // Arrange
      const dto = {
        name: 'Permission',
        slug: 'existing:permission',
        resource: 'test',
        action: 'read',
      };
      rbacService.createPermission.mockRejectedValue(new ConflictException());

      // Act & Assert
      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('list', () => {
    it('should return paginated permissions', async () => {
      // Arrange
      const paginatedResult = {
        data: [mockPermission],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      rbacService.listPermissions.mockResolvedValue(paginatedResult as any);

      // Act
      const result = await controller.list();

      // Assert
      expect(rbacService.listPermissions).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual(paginatedResult.meta);
    });

    it('should pass query parameters to service', async () => {
      // Arrange
      rbacService.listPermissions.mockResolvedValue({ data: [], meta: {} } as any);

      // Act
      await controller.list('2', '10', 'content', 'create');

      // Assert
      expect(rbacService.listPermissions).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        resource: 'content',
        action: 'create',
      });
    });
  });

  describe('get', () => {
    it('should return permission details', async () => {
      // Arrange
      rbacService.getPermission.mockResolvedValue(mockPermission as any);

      // Act
      const result = await controller.get('permission-1');

      // Assert
      expect(rbacService.getPermission).toHaveBeenCalledWith('permission-1');
      expect(result.id).toBe(mockPermission.id);
    });

    it('should propagate NotFoundException from service', async () => {
      // Arrange
      rbacService.getPermission.mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(controller.get('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete permission', async () => {
      // Arrange
      rbacService.deletePermission.mockResolvedValue(undefined);

      // Act
      await controller.delete('permission-1');

      // Assert
      expect(rbacService.deletePermission).toHaveBeenCalledWith('permission-1');
    });

    it('should propagate NotFoundException from service', async () => {
      // Arrange
      rbacService.deletePermission.mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(controller.delete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
