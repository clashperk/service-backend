import { JwtAuthGuard, RolesGuard } from '@app/auth';
import { LegendAttacksEntity } from '@app/entities/legend-attacks.entity';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetLegendAttacksInput } from './dto';
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

  @Get('/:playerTag/wars')
  @Header('Cache-Control', 'max-age=600')
  getWarHistory(
    @Param('playerTag') playerTag: string,
    @Query() query: AttackHistoryQueryInput,
  ): Promise<AttackHistoryOutput[]> {
    return this.playersService.getClanWarHistory(playerTag, query.months);
  }

  @Get('/:playerTag/wars-v2')
  @Header('Cache-Control', 'max-age=600')
  getWarHistoryV2(
    @Param('playerTag') playerTag: string,
    @Query() query: AttackHistoryQueryInput,
  ): Promise<AttackHistoryOutput[]> {
    return this.playersService.getClanWarHistory(playerTag, query.months);
  }

  @Get('/:playerTag/cwl-stats')
  @Header('Cache-Control', 'max-age=600')
  getClanWarLeagueStats(
    @Param('playerTag') playerTag: string,
    @Query() query: AttackHistoryQueryInput,
  ): Promise<CWLAttackSummaryOutput[]> {
    return this.playersService.getCWLAttackSummary(playerTag, query.months);
  }

  @Header('Cache-Control', 'max-age=300')
  @Get('/legend-attacks/:playerTag')
  async getLegendAttacks(@Param('playerTag') playerTag: string): Promise<LegendAttacksEntity> {
    const [result] = await this.playersService.getLegendAttacks([playerTag]);
    if (!result) throw new NotFoundException('Legend attacks not found');
    return result;
  }

  @Header('Cache-Control', 'max-age=300')
  @HttpCode(200)
  @Post('/legend-attacks')
  getLegendAttacksBulk(@Body() body: GetLegendAttacksInput): Promise<LegendAttacksEntity[]> {
    return this.playersService.getLegendAttacks(body.playerTags);
  }
}
