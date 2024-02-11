import { ClashClientModule } from '@app/clash-client';
import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceRankingController } from './service-ranking.controller';
import { RankingService } from './service-ranking.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongoDbModule,
    RedisModule,
    ClashClientModule,
  ],
  controllers: [ServiceRankingController],
  providers: [RankingService],
})
export class ServiceRankingModule {}
