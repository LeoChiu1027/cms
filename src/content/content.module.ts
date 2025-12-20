import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Tag } from './entities/tag.entity';
import { Content } from './entities/content.entity';
import { Blog } from './entities/blog.entity';
import { Product } from './entities/product.entity';
import { ContentTag } from './entities/content-tag.entity';
import { ContentVersion } from './entities/content-version.entity';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { BlogsService } from './blogs.service';
import { BlogsController } from './blogs.controller';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      Tag,
      Content,
      Blog,
      Product,
      ContentTag,
      ContentVersion,
    ]),
  ],
  controllers: [TagsController, BlogsController, ProductsController, ContentController],
  providers: [TagsService, BlogsService, ProductsService, ContentService],
  exports: [TagsService, BlogsService, ProductsService, ContentService],
})
export class ContentModule {}
