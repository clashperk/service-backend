import { ClashClientModule } from '@app/clash-client';
import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';

@Module({
  imports: [ClashClientModule],
  controllers: [PlayersController],
  providers: [PlayersService],
})
export class PlayersModule {}
