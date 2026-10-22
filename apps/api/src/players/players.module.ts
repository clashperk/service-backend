import { Global, Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { GlobalService } from './services/global.service';
import { PlayerWarsService } from './services/player-wars.service';
import { RankedService } from './services/ranked.service';

@Global()
@Module({
  controllers: [PlayersController],
  providers: [PlayerWarsService, PlayersService, GlobalService, RankedService],
})
export class PlayersModule {}
