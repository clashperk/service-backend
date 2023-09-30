import { Module } from '@nestjs/common';
import { ServiceClansController } from './service-clans.controller';
import { ClansService } from './service-clans.service';
import { MongodbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { RestModule } from '@app/rest';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongodbModule, RedisModule, RestModule],
  controllers: [ServiceClansController],
  providers: [ClansService],
})
export class ServiceClansModule {}
