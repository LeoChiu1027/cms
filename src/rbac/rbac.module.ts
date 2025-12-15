import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { RbacService } from './rbac.service';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { UserRolesController } from './user-roles.controller';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    MikroOrmModule.forFeature([Role, Permission, RolePermission, UserRole]),
  ],
  controllers: [RolesController, PermissionsController, UserRolesController],
  providers: [RbacService, PermissionsGuard, RolesGuard],
  exports: [RbacService, PermissionsGuard, RolesGuard],
})
export class RbacModule {}
