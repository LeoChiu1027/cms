import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { RbacService } from './rbac.service';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { User } from '../auth/entities/user.entity';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UserRolesController {
  constructor(private readonly rbacService: RbacService) {}

  @Get(':userId/roles')
  async getUserRoles(@Param('userId', ParseUUIDPipe) userId: string) {
    const roles = await this.rbacService.getUserRoles(userId);
    return {
      data: roles.map((role) => this.serializeRole(role)),
    };
  }

  @Post(':userId/roles')
  @HttpCode(HttpStatus.OK)
  async assignRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRolesDto,
    @Req() req: Request & { user: User },
  ) {
    const roles = await this.rbacService.assignRolesToUser(
      userId,
      dto.roleIds,
      req.user.id,
    );
    return {
      data: roles.map((role) => this.serializeRole(role)),
    };
  }

  @Delete(':userId/roles')
  @HttpCode(HttpStatus.OK)
  async removeRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRolesDto,
  ) {
    const roles = await this.rbacService.removeRolesFromUser(userId, dto.roleIds);
    return {
      data: roles.map((role) => this.serializeRole(role)),
    };
  }

  @Get(':userId/permissions')
  async getUserPermissions(@Param('userId', ParseUUIDPipe) userId: string) {
    const permissions = await this.rbacService.getUserPermissions(userId);
    return {
      data: permissions.map((p) => this.serializePermission(p)),
    };
  }

  private serializeRole(role: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
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

  private serializePermission(permission: {
    id: string;
    name: string;
    slug: string;
    resource: string;
    action: string;
    description?: string;
    createdAt: Date;
  }) {
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
