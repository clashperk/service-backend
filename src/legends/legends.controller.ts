import { Cache } from '@app/decorators';
import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import {
  GetLegendAttacksInputDto,
  LegendAttacksDto,
  LegendAttacksItemsDto,
  LegendRankingThresholdsDto,
} from '../players/dto';
import { LeaderboardByTagsInputDto, LeaderboardByTagsItemsDto } from './dto';
import { LegendsService } from './legends.service';
import { LegendTasksService } from './services/legend-tasks.service';

@Controller('/legends')
export class LegendsController {
  constructor(
    private legendService: LegendsService,
    private legendTasksService: LegendTasksService,
  ) {}

  @Get('/ranking-thresholds')
  @Cache(300)
  async getLegendRankingThresholds(): Promise<LegendRankingThresholdsDto> {
    const [live, history, eod] = await Promise.all([
      this.legendTasksService.getRanksThresholds(),
      this.legendTasksService.getHistoricalRanksThresholds(),
      this.legendTasksService.getEoDThresholds(),
    ]);
    return { live: { timestamp: new Date().toISOString(), thresholds: live }, eod, history };
  }

  @Post('/leaderboard/query')
  @Cache(300)
  async getLeaderboard(
    @Body() body: LeaderboardByTagsInputDto,
  ): Promise<LeaderboardByTagsItemsDto> {
    const items = body.playerTags?.length
      ? await this.legendTasksService.getRanksByPlayerTags(body.playerTags)
      : await this.legendTasksService.getRanksByRange(body.minRank, body.maxRank);

    return { items };
  }

  @Post('/attacks/query')
  @HttpCode(200)
  @Cache(300)
  getLegendAttacks(@Body() body: GetLegendAttacksInputDto): Promise<LegendAttacksItemsDto> {
    return this.legendService.getLegendAttacks(body);
  }

  @Get('/:playerTag/attacks')
  @Cache(300)
  async getLegendAttacksByPlayerTag(
    @Param('playerTag') playerTag: string,
  ): Promise<LegendAttacksDto> {
    const {
      items: [log],
    } = await this.legendService.getLegendAttacks({ playerTags: [playerTag] });

    if (log) return log;
    throw new NotFoundException('Legend attacks not found.');
  }
}
