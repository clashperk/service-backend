import { Cache } from '@app/decorators';
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import {
  AggregateAttackHistoryDto,
  AttackHistoryInputDto,
  AttackHistoryItemsDto,
  ClanHistoryItemsDto,
  GetLegendAttacksInputDto,
  LegendAttacksItemsDto,
} from './dto';
import { GlobalService } from './services/global.service';
import { LegendService } from './services/legend.service';
import { PlayerWarsService } from './services/wars.service';

@Controller('/players')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(
    private playerWarsService: PlayerWarsService,
    private globalService: GlobalService,
    private legendService: LegendService,
  ) {}

  @Post('/legend-attacks')
  @Cache(600)
  getLegendAttacks(@Body() body: GetLegendAttacksInputDto): Promise<LegendAttacksItemsDto> {
    return this.legendService.getLegendAttacks(body);
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
}
