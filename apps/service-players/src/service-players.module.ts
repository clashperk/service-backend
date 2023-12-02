import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { RestModule } from '@app/rest';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServicePlayersController } from './service-players.controller';
import { PlayersService } from './service-players.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongoDbModule, RedisModule, RestModule],
  controllers: [ServicePlayersController],
  providers: [PlayersService],
})
export class ServicePlayersModule {}
