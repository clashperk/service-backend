import { Global, Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { GlobalService } from './services/global.service';
import { PlayerWarsService } from './services/wars.service';

@Global()
@Module({
  controllers: [PlayersController],
  providers: [PlayerWarsService, PlayersService, GlobalService],
  exports: [PlayerWarsService, PlayersService, GlobalService],
})
export class PlayersModule {}
