import { Cache } from '@app/decorators';
import { Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, UserRoles } from '../auth';
import {
  AggregateAttackHistoryItemsDto,
  AttackHistoryInputDto,
  AttackHistoryItemsDto,
  ClanHistoryItemsDto,
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
  ) {}

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
  ): Promise<AggregateAttackHistoryItemsDto> {
    return this.playerWarsService.aggregateAttackHistory({ playerTag, startDate: query.startDate });
  }

  @Get('/:playerTag/clan-war-leagues/aggregate')
  @Cache(600)
  aggregateClanWarLeagueHistory(
    @Param('playerTag') playerTag: string,
    @Query() query: AttackHistoryInputDto,
  ) {
    return this.playerWarsService.aggregateClanWarLeagueHistory({
      playerTag,
      startDate: query.startDate,
    });
  }

  @Put('/:playerTag')
  @Roles([UserRoles.ADMIN])
  async addPlayerAccount(@Param('playerTag') playerTag: string) {
    return this.playersService.addPlayer(playerTag);
  }
}
