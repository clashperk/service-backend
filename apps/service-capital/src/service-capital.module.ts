import { ClashClientModule } from '@app/clash-client';
import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceCapitalController } from './service-capital.controller';
import { CapitalService } from './service-capital.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongoDbModule,
    RedisModule,
    ClashClientModule,
  ],
  controllers: [ServiceCapitalController],
  providers: [CapitalService],
})
export class ServiceCapitalModule {}
