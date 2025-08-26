import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as repositories from './repositories';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const options: TypeOrmModuleOptions = {
          type: 'postgres',
          host: configService.getOrThrow<string>('POSTGRES_HOST'),
          port: configService.getOrThrow<number>('POSTGRES_PORT'),
          username: configService.getOrThrow<string>('POSTGRES_USERNAME'),
          password: configService.getOrThrow<string>('POSTGRES_PASSWORD'),
          database: configService.getOrThrow<string>('POSTGRES_DB'),
          entities: [__dirname + '/../**/entities/**/*.entity.js'],
          migrations: [__dirname + '/../**/migrations/**/*.js'],
          namingStrategy: new SnakeNamingStrategy(),
          migrationsRun: !!configService.get('RUN_DB_MIGRATIONS_ON_START'),
          migrationsTableName: 'migrations',
          synchronize: false,
          migrationsTransactionMode: 'each',
          logging: configService.get('NODE_ENV') === 'development',
        };

        return options;
      },
    }),
  ],
  providers: [...Object.values(repositories)],
  exports: Object.values(repositories),
})
export class PostgresModule {}
