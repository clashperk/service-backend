import { Module } from '@nestjs/common';
import { ServiceWarsController } from './service-wars.controller';
import { WarsService } from './service-wars.service';
import { MongodbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { RestModule } from '@app/rest';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongodbModule, RedisModule, RestModule],
  controllers: [ServiceWarsController],
  providers: [WarsService],
})
export class ServiceWarsModule {}
