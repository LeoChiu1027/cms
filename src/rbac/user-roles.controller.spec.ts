import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRolesController } from './user-roles.controller';
import { RbacService } from './rbac.service';

describe('UserRolesController', () => {
  let controller: UserRolesController;
  let rbacService: jest.Mocked<RbacService>;

  const mockRole = {
    id: 'role-1',
    name: 'Test Role',
    slug: 'test-role',
    description: 'Test description',
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
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
  };

  beforeEach(async () => {
    const mockRbacService = {
      getUserRoles: jest.fn(),
      assignRolesToUser: jest.fn(),
      removeRolesFromUser: jest.fn(),
      getUserPermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserRolesController],
      providers: [
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
      ],
    }).compile();

    controller = module.get<UserRolesController>(UserRolesController);
    rbacService = module.get(RbacService);
  });

  describe('getUserRoles', () => {
    it('should return user roles', async () => {
      // Arrange
      rbacService.getUserRoles.mockResolvedValue([mockRole] as any);

      // Act
      const result = await controller.getUserRoles('user-1');

      // Assert
      expect(rbacService.getUserRoles).toHaveBeenCalledWith('user-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockRole.id);
    });

    it('should propagate NotFoundException from service', async () => {
      // Arrange
      rbacService.getUserRoles.mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(controller.getUserRoles('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignRoles', () => {
    it('should assign roles to user', async () => {
      // Arrange
      const mockRequest = { user: { id: 'admin-1' } } as any;
      rbacService.assignRolesToUser.mockResolvedValue([mockRole] as any);

      // Act
      const result = await controller.assignRoles(
        'user-1',
        { roleIds: ['role-1'] },
        mockRequest,
      );

      // Assert
      expect(rbacService.assignRolesToUser).toHaveBeenCalledWith(
        'user-1',
        ['role-1'],
        'admin-1',
      );
      expect(result.data).toHaveLength(1);
    });

    it('should propagate BadRequestException for invalid role IDs', async () => {
      // Arrange
      const mockRequest = { user: { id: 'admin-1' } } as any;
      rbacService.assignRolesToUser.mockRejectedValue(new BadRequestException());

      // Act & Assert
      await expect(
        controller.assignRoles('user-1', { roleIds: ['invalid'] }, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException for non-existent user', async () => {
      // Arrange
      const mockRequest = { user: { id: 'admin-1' } } as any;
      rbacService.assignRolesToUser.mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(
        controller.assignRoles('non-existent', { roleIds: ['role-1'] }, mockRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeRoles', () => {
    it('should remove roles from user', async () => {
      // Arrange
      rbacService.removeRolesFromUser.mockResolvedValue([]);

      // Act
      const result = await controller.removeRoles('user-1', { roleIds: ['role-1'] });

      // Assert
      expect(rbacService.removeRolesFromUser).toHaveBeenCalledWith('user-1', ['role-1']);
      expect(result.data).toHaveLength(0);
    });

    it('should propagate NotFoundException from service', async () => {
      // Arrange
      rbacService.removeRolesFromUser.mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(
        controller.removeRoles('non-existent', { roleIds: ['role-1'] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserPermissions', () => {
    it('should return user effective permissions', async () => {
      // Arrange
      rbacService.getUserPermissions.mockResolvedValue([mockPermission] as any);

      // Act
      const result = await controller.getUserPermissions('user-1');

      // Assert
      expect(rbacService.getUserPermissions).toHaveBeenCalledWith('user-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockPermission.id);
    });

    it('should propagate NotFoundException from service', async () => {
      // Arrange
      rbacService.getUserPermissions.mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(controller.getUserPermissions('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
