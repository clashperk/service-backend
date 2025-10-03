import { Global, Module } from '@nestjs/common';
import { LegendTasksService } from '../tasks/services/legend-tasks.service';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { GlobalService } from './services/global.service';
import { LegendService } from './services/legend.service';
import { PlayerWarsService } from './services/player-wars.service';

@Global()
@Module({
  controllers: [PlayersController],
  providers: [PlayerWarsService, PlayersService, GlobalService, LegendService, LegendTasksService],
  exports: [PlayerWarsService, PlayersService, GlobalService, LegendService],
})
export class PlayersModule {}
