import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { RestModule } from '@app/rest';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceCapitalController } from './service-capital.controller';
import { CapitalService } from './service-capital.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongoDbModule, RedisModule, RestModule],
  controllers: [ServiceCapitalController],
  providers: [CapitalService],
})
export class ServiceCapitalModule {}
