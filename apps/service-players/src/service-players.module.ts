import { ClashClientModule } from '@app/clash-client';
import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServicePlayersController } from './service-players.controller';
import { PlayersService } from './service-players.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongoDbModule,
    RedisModule,
    ClashClientModule,
  ],
  controllers: [ServicePlayersController],
  providers: [PlayersService],
})
export class ServicePlayersModule {}
