import { MongodbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { RestModule } from '@app/rest';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceRankingController } from './service-ranking.controller';
import { RankingService } from './service-ranking.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongodbModule, RedisModule, RestModule],
  controllers: [ServiceRankingController],
  providers: [RankingService],
})
export class ServiceRankingModule {}
