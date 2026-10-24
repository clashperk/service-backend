import { Season } from '@app/clash-client';
import { Cache } from '@app/decorators';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import {
  GetLegendAttacksInputDto,
  LegendAttacksDto,
  LegendAttacksItemsDto,
  LegendRankingThresholdsDto,
} from '../players/dto';
import { LegendRankDto, LegendSeasonInputDto, LegendSeasonsDto } from './dto';
import { LegendsService } from './legends.service';
import { LegendTasksService } from './services/legend-tasks.service';
import { ApiTag } from '../api-tags';

@ApiTags(ApiTag.LEGENDS)
@Controller('/legends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
    @Query() { seasonId }: LegendSeasonInputDto,
  ): Promise<LegendAttacksDto> {
    const {
      items: [log],
    } = await this.legendService.getLegendAttacks(
      { playerTags: [playerTag] },
      seasonId ?? Season.leagueId,
    );

    if (log) return log;
    throw new NotFoundException('Legend attacks not found.');
  }

  @Get('/:playerTag/seasons')
  @Cache(300)
  async getLegendSeasons(@Param('playerTag') playerTag: string): Promise<LegendSeasonsDto> {
    return { items: await this.legendService.getLegendSeasons(playerTag) };
  }

  @Get('/:playerTag/estimate-rank')
  @Cache(300)
  async estimateRank(@Param('playerTag') playerTag: string): Promise<LegendRankDto> {
    const [item] = await this.legendTasksService.getRanksByPlayerTags([playerTag]);
    if (!item) throw new NotFoundException();

    return item;
  }
}
