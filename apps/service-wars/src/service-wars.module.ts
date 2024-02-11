import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import * as repositories from '@app/repositories';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceWarsController } from './service-wars.controller';
import { WarsService } from './service-wars.service';
import { ClashClientModule } from '@app/clash-client';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongoDbModule,
    RedisModule,
    ClashClientModule,
  ],
  controllers: [ServiceWarsController],
  providers: [WarsService, ...Object.values(repositories)],
})
export class ServiceWarsModule {}
