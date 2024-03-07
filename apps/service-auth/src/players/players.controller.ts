import { JwtAuthGuard, RolesGuard } from '@app/auth';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttackHistoryQueryInput } from './dto/attack-history-input.dto';
import { AttackHistoryOutput } from './dto/attack-history-output.dto';
import { CWLAttackSummaryOutput } from './dto/attack-summary-output.dto';
import { PlayersService } from './players.service';

@ApiTags('PLAYERS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('/players')
export class PlayersController {
  constructor(private playersService: PlayersService) {}

  @Get('/:playerTag/clan-wars')
  getWarHistory(
    @Param('playerTag') playerTag: string,
    @Query() query: AttackHistoryQueryInput,
  ): Promise<AttackHistoryOutput[]> {
    return this.playersService.getClanWarHistory(playerTag, query.months);
  }

  @Get('/:playerTag/clan-war-league-stats')
  getClanWarLeagueStats(
    @Param('playerTag') playerTag: string,
    @Query() query: AttackHistoryQueryInput,
  ): Promise<CWLAttackSummaryOutput[]> {
    return this.playersService.getCWLAttackSummary(playerTag, query.months);
  }
}
