import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { RestModule } from '@app/rest';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceClansController } from './service-clans.controller';
import { ClansService } from './service-clans.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongoDbModule, RedisModule, RestModule],
  controllers: [ServiceClansController],
  providers: [ClansService],
})
export class ServiceClansModule {}
