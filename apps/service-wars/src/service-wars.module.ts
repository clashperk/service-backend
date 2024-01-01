import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import * as repositories from '@app/repositories';
import { RestModule } from '@app/rest';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceWarsController } from './service-wars.controller';
import { WarsService } from './service-wars.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongoDbModule, RedisModule, RestModule],
  controllers: [ServiceWarsController],
  providers: [WarsService, ...Object.values(repositories)],
})
export class ServiceWarsModule {}
