import { JwtAuthGuard } from '@app/auth';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlayersService } from './players.service';

@ApiTags('PLAYERS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('/players')
export class PlayersController {
  constructor(private playersService: PlayersService) {}

  @Get('/:playerTag/clan-wars')
  getWarHistory() {}

  @Get('/:playerTag/clan-war-league-stats')
  getClanWarLeagueStats() {}
}
