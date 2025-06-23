import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as repositories from './repositories';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const options: TypeOrmModuleOptions = {
          type: 'mongodb',
          url: configService.getOrThrow('MONGODB_URL'),
          entities: [__dirname + '/../**/entities/**/*.entity.js'],
          migrations: [__dirname + '/../**/migrations/**/*.js'],
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
export class RdbModule {}
