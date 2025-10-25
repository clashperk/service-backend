import { Cache } from '@app/decorators';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, UserRoles } from '../auth';
import { LegendsService } from '../legends/legends.service';
import { LegendTasksService } from '../legends/services/legend-tasks.service';
import {
  AggregateAttackHistoryDto,
  AttackHistoryInputDto,
  AttackHistoryItemsDto,
  ClanHistoryItemsDto,
  GetLegendAttacksInputDto,
  LegendAttacksDto,
  LegendAttacksItemsDto,
  LegendRankingThresholdsDto,
} from './dto';
import { PlayersService } from './players.service';
import { GlobalService } from './services/global.service';
import { PlayerWarsService } from './services/player-wars.service';

@Controller('/players')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(
    private playerWarsService: PlayerWarsService,
    private playersService: PlayersService,
    private globalService: GlobalService,
    private legendService: LegendsService,
    private legendTasksService: LegendTasksService,
  ) {}

  @Get('/legend-ranking-thresholds')
  @Cache(300)
  @ApiExcludeEndpoint()
  async getLegendRankingThresholds(): Promise<LegendRankingThresholdsDto> {
    const [live, history, eod] = await Promise.all([
      this.legendTasksService.getRanksThresholds(),
      this.legendTasksService.getHistoricalRanksThresholds(),
      this.legendTasksService.getEoDThresholds(),
    ]);
    return { live: { timestamp: new Date().toISOString(), thresholds: live }, eod, history };
  }

  @Post('/legend-attacks/query')
  @HttpCode(200)
  @Cache(300)
  @ApiExcludeEndpoint()
  getLegendAttacks(@Body() body: GetLegendAttacksInputDto): Promise<LegendAttacksItemsDto> {
    return this.legendService.getLegendAttacks(body);
  }

  @Get('/:playerTag/legend-attacks')
  @Cache(300)
  @ApiExcludeEndpoint()
  async getLegendAttacksByPlayerTag(
    @Param('playerTag') playerTag: string,
  ): Promise<LegendAttacksDto> {
    const {
      items: [log],
    } = await this.legendService.getLegendAttacks({ playerTags: [playerTag] });

    if (log) return log;
    throw new NotFoundException('Legend attacks not found.');
  }

  @Get('/:playerTag/history')
  @Cache(600)
  getClanHistory(@Param('playerTag') playerTag: string): Promise<ClanHistoryItemsDto> {
    return this.globalService.getPlayerClanHistory(playerTag);
  }

  @Get('/:playerTag/wars')
  @Cache(600)
  getAttackHistory(
    @Param('playerTag') playerTag: string,
    @Query() query: AttackHistoryInputDto,
  ): Promise<AttackHistoryItemsDto> {
    return this.playerWarsService.getAttackHistory({ playerTag, startDate: query.startDate });
  }

  @Get('/:playerTag/wars/aggregate')
  @Cache(600)
  aggregateAttackHistory(
    @Param('playerTag') playerTag: string,
    @Query() query: AttackHistoryInputDto,
  ): Promise<AggregateAttackHistoryDto> {
    return this.playerWarsService.aggregateAttackHistory({ playerTag, startDate: query.startDate });
  }

  @Put('/:playerTag')
  @Roles([UserRoles.ADMIN])
  async addPlayerAccount(@Param('playerTag') playerTag: string) {
    return this.playersService.addPlayer(playerTag);
  }
}
