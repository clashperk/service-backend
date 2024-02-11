import { ClashClientModule } from '@app/clash-client';
import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceClansController } from './service-clans.controller';
import { ClansService } from './service-clans.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongoDbModule,
    RedisModule,
    ClashClientModule,
  ],
  controllers: [ServiceClansController],
  providers: [ClansService],
})
export class ServiceClansModule {}
