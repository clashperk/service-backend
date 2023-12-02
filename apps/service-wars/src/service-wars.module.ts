import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { RestModule } from '@app/rest';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceWarsController } from './service-wars.controller';
import { WarsService } from './service-wars.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongoDbModule, RedisModule, RestModule],
  controllers: [ServiceWarsController],
  providers: [WarsService],
})
export class ServiceWarsModule {}
