import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TerminusModule } from '@nestjs/terminus';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

import configuration from './config/configuration';
import { validationSchema } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { ContentModule } from './content/content.module';
import { User } from './auth/entities/user.entity';
import { Session } from './auth/entities/session.entity';
import { Role } from './rbac/entities/role.entity';
import { Permission } from './rbac/entities/permission.entity';
import { RolePermission } from './rbac/entities/role-permission.entity';
import { UserRole } from './rbac/entities/user-role.entity';
import { Tag } from './content/entities/tag.entity';
import { Content } from './content/entities/content.entity';
import { Blog } from './content/entities/blog.entity';
import { Product } from './content/entities/product.entity';
import { ContentTag } from './content/entities/content-tag.entity';
import { ContentVersion } from './content/entities/content-version.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    MikroOrmModule.forRootAsync({
      driver: PostgreSqlDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        driver: PostgreSqlDriver,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        dbName: config.get<string>('database.name'),
        user: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        entities: [
          User,
          Session,
          Role,
          Permission,
          RolePermission,
          UserRole,
          Tag,
          Content,
          Blog,
          Product,
          ContentTag,
          ContentVersion,
        ],
        debug: config.get<string>('nodeEnv') === 'development',
        allowGlobalContext: true,
        schemaGenerator: {
          disableForeignKeys: false,
          createForeignKeyConstraints: true,
        },
        extensions: [Migrator],
        migrations: {
          path: 'dist/migrations',
          pathTs: 'src/migrations',
        },
      }),
    }),
    TerminusModule,
    AuthModule,
    RbacModule,
    ContentModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
