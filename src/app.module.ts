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
import { User } from './auth/entities/user.entity';
import { Session } from './auth/entities/session.entity';

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
        entities: [User, Session],
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
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
