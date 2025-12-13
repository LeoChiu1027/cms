import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { RbacService } from '../rbac.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
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
      userHasAnyRole: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: RbacService, useValue: mockRbacService },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);
    rbacService = module.get(RbacService);
  });

  it('should allow access when no roles are required', async () => {
    // Arrange
    reflector.getAllAndOverride.mockReturnValue(null);
    const context = createMockExecutionContext(mockUser);

    // Act
    const result = await guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
    expect(rbacService.userHasAnyRole).not.toHaveBeenCalled();
  });

  it('should allow access when empty roles array', async () => {
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
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = createMockExecutionContext(null);

    // Act & Assert
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access when user has any of the required roles', async () => {
    // Arrange
    const requiredRoles = ['admin', 'moderator'];
    reflector.getAllAndOverride.mockReturnValue(requiredRoles);
    rbacService.userHasAnyRole.mockResolvedValue(true);
    const context = createMockExecutionContext(mockUser);

    // Act
    const result = await guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
    expect(rbacService.userHasAnyRole).toHaveBeenCalledWith(
      mockUser.id,
      requiredRoles,
    );
  });

  it('should throw ForbiddenException when user lacks all required roles', async () => {
    // Arrange
    const requiredRoles = ['admin', 'moderator'];
    reflector.getAllAndOverride.mockReturnValue(requiredRoles);
    rbacService.userHasAnyRole.mockResolvedValue(false);
    const context = createMockExecutionContext(mockUser);

    // Act & Assert
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      `Required role: ${requiredRoles.join(' or ')}`,
    );
  });
});
