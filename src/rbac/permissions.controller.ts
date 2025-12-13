import {
  Controller,
  Get,
  Post,
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
import { CreatePermissionDto } from './dto/create-permission.dto';

@Controller('permissions')
@UseGuards(AuthGuard('jwt'))
export class PermissionsController {
  constructor(private readonly rbacService: RbacService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePermissionDto) {
    const permission = await this.rbacService.createPermission(dto);
    return this.serializePermission(permission);
  }

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
  ) {
    const result = await this.rbacService.listPermissions({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      resource,
      action,
    });

    return {
      data: result.data.map((p) => this.serializePermission(p)),
      meta: result.meta,
    };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const permission = await this.rbacService.getPermission(id);
    return this.serializePermission(permission);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.rbacService.deletePermission(id);
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
