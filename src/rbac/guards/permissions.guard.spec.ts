import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { RbacService } from '../rbac.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;
  let rbacService: jest.Mocked<RbacService>;

  const mockUser = { id: 'user-1', email: 'test@example.com' };

  const createMockExecutionContext = (user?: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const mockRbacService = {
      userHasAllPermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: RbacService, useValue: mockRbacService },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get(Reflector);
    rbacService = module.get(RbacService);
  });

  it('should allow access when no permissions are required', async () => {
    // Arrange
    reflector.getAllAndOverride.mockReturnValue(null);
    const context = createMockExecutionContext(mockUser);

    // Act
    const result = await guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
    expect(rbacService.userHasAllPermissions).not.toHaveBeenCalled();
  });

  it('should allow access when empty permissions array', async () => {
    // Arrange
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = createMockExecutionContext(mockUser);

    // Act
    const result = await guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user is not authenticated', async () => {
    // Arrange
    reflector.getAllAndOverride.mockReturnValue(['content:read']);
    const context = createMockExecutionContext(null);

    // Act & Assert
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access when user has all required permissions', async () => {
    // Arrange
    const requiredPermissions = ['content:read', 'content:write'];
    reflector.getAllAndOverride.mockReturnValue(requiredPermissions);
    rbacService.userHasAllPermissions.mockResolvedValue(true);
    const context = createMockExecutionContext(mockUser);

    // Act
    const result = await guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
    expect(rbacService.userHasAllPermissions).toHaveBeenCalledWith(
      mockUser.id,
      requiredPermissions,
    );
  });

  it('should throw ForbiddenException when user lacks required permissions', async () => {
    // Arrange
    const requiredPermissions = ['content:read', 'content:write'];
    reflector.getAllAndOverride.mockReturnValue(requiredPermissions);
    rbacService.userHasAllPermissions.mockResolvedValue(false);
    const context = createMockExecutionContext(mockUser);

    // Act & Assert
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      `Required permissions: ${requiredPermissions.join(', ')}`,
    );
  });
});
