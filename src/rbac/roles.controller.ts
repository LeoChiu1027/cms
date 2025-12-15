import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacService } from './rbac.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';

@Controller('roles')
@UseGuards(AuthGuard('jwt'))
export class RolesController {
  constructor(private readonly rbacService: RbacService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRoleDto) {
    const role = await this.rbacService.createRole(dto);
    return this.serializeRole(role);
  }

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isSystem') isSystem?: string,
  ) {
    const result = await this.rbacService.listRoles({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      isSystem: isSystem !== undefined ? isSystem === 'true' : undefined,
    });

    return {
      data: result.data.map((role) => this.serializeRole(role)),
      meta: result.meta,
    };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.rbacService.getRole(id);
    return this.serializeRoleWithPermissions(role);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const role = await this.rbacService.updateRole(id, dto);
    return this.serializeRole(role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.rbacService.deleteRole(id);
  }

  // =========================================
  // ROLE PERMISSIONS
  // =========================================

  @Get(':roleId/permissions')
  async getPermissions(@Param('roleId', ParseUUIDPipe) roleId: string) {
    const permissions = await this.rbacService.getRolePermissions(roleId);
    return {
      data: permissions.map((p) => this.serializePermission(p)),
    };
  }

  @Post(':roleId/permissions')
  @HttpCode(HttpStatus.OK)
  async assignPermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    const role = await this.rbacService.assignPermissionsToRole(
      roleId,
      dto.permissionIds,
    );
    return this.serializeRoleWithPermissions(role);
  }

  @Delete(':roleId/permissions')
  async removePermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    const role = await this.rbacService.removePermissionsFromRole(
      roleId,
      dto.permissionIds,
    );
    return this.serializeRoleWithPermissions(role);
  }

  // =========================================
  // SERIALIZATION
  // =========================================

  private serializeRole(role: { id: string; name: string; slug: string; description?: string; isSystem: boolean; createdAt: Date; updatedAt: Date }) {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  private serializeRoleWithPermissions(role: { id: string; name: string; slug: string; description?: string; isSystem: boolean; createdAt: Date; updatedAt: Date; permissions: { getItems: () => Array<{ id: string; name: string; slug: string; resource: string; action: string; description?: string; createdAt: Date }> } }) {
    return {
      ...this.serializeRole(role),
      permissions: role.permissions.getItems().map((p) => this.serializePermission(p)),
    };
  }

  private serializePermission(permission: { id: string; name: string; slug: string; resource: string; action: string; description?: string; createdAt: Date }) {
    return {
      id: permission.id,
      name: permission.name,
      slug: permission.slug,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      createdAt: permission.createdAt,
    };
  }
}
