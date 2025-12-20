import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { User } from '../auth/entities/user.entity';

@Controller('blogs')
@UseGuards(AuthGuard('jwt'))
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Post()
  async create(
    @Body() createBlogDto: CreateBlogDto,
    @Req() req: Request & { user: User },
  ) {
    return this.blogsService.create(createBlogDto, req.user);
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const { data, total } = await this.blogsService.findAll(pageNum, limitNum, {
      status,
      isFeatured: isFeatured === 'true' ? true : isFeatured === 'false' ? false : undefined,
      search,
    });

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.blogsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBlogDto: UpdateBlogDto,
    @Req() req: Request & { user: User },
  ) {
    return this.blogsService.update(id, updateBlogDto, req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.blogsService.remove(id);
  }

  @Get(':id/tags')
  async getTags(@Param('id', ParseUUIDPipe) id: string) {
    const tags = await this.blogsService.getTags(id);
    return { data: tags };
  }

  @Post(':id/tags')
  @HttpCode(HttpStatus.OK)
  async addTags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { tagIds: string[] },
  ) {
    await this.blogsService.addTags(id, body.tagIds);
    const tags = await this.blogsService.getTags(id);
    return { data: tags };
  }

  @Delete(':id/tags')
  async removeTags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { tagIds: string[] },
  ) {
    await this.blogsService.removeTags(id, body.tagIds);
    const tags = await this.blogsService.getTags(id);
    return { data: tags };
  }
}
