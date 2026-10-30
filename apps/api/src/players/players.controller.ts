import { PlayerDto } from '@app/clash-client';
import { Cache, DeprecatedPost } from '@app/decorators';
import { ResultOkDto } from '@app/dto';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  QueryMethod,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, UserRoles } from '../auth';
import {
  AggregateAttackHistoryItemsDto,
  AggregateClanWarLeagueHistoryItemsDto,
  AttackHistoryInputDto,
  PlayerWarsInputDto,
  AttackHistoryItemsDto,
  BattleLogAggregateItemsDto,
  BattleLogItemsDto,
  BattleLogLeaderboardDto,
  BattleLogLeaderboardInputDto,
  ClanHistoryItemsDto,
  PlayerSeasonStatsInputDto,
  PlayerSeasonStatsItemsDto,
  RankedDto,
} from './dto';
import { PlayersService } from './players.service';
import { GlobalService } from './services/global.service';
import { PlayerWarsService } from './services/player-wars.service';
import { RankedService } from './services/ranked.service';
import { ApiTag } from '../api-tags';

@ApiTags(ApiTag.PLAYERS)
@Controller('/players')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlayersController {
  constructor(
    private playerWarsService: PlayerWarsService,
    private playersService: PlayersService,
    private globalService: GlobalService,
    private rankedService: RankedService,
  ) {}

  @Get('/:playerTag')
  @Cache(120)
  getPlayer(@Param('playerTag') playerTag: string): Promise<PlayerDto> {
    return this.playersService.getPlayer(playerTag);
  }

  @Get('/:playerTag/seasons')
  @Cache(600)
  getSeasonStats(
    @Param('playerTag') playerTag: string,
    @Query() query: PlayerSeasonStatsInputDto,
  ): Promise<PlayerSeasonStatsItemsDto> {
    return this.playersService.getSeasonStats(playerTag, query.limit);
  }

  @Get('/:playerTag/ranked')
  @Cache(300)
  getRanked(@Param('playerTag') playerTag: string): Promise<RankedDto> {
    return this.rankedService.getRanked(playerTag);
  }

  @Get('/:playerTag/battle-log')
  @Cache(600)
  getBattleLog(@Param('playerTag') playerTag: string): Promise<BattleLogItemsDto> {
    return this.playersService.getPlayerBattleLog(playerTag);
  }

  @Get('/:playerTag/battle-log/aggregate')
  @Cache(600)
  getBattleLogAggregate(
    @Param('playerTag') playerTag: string,
  ): Promise<BattleLogAggregateItemsDto> {
    return this.playersService.getPlayerBattleLogAggregate(playerTag);
  }

  @QueryMethod('/battle-log/leaderboard')
  @Cache(600, { unorderedBody: true })
  getBattleLogLeaderboard(
    @Body() body: BattleLogLeaderboardInputDto,
  ): Promise<BattleLogLeaderboardDto> {
    return this.playersService.getBattleLogLeaderboard(body);
  }

  @Post('/battle-log/leaderboard')
  @Cache(600, { unorderedBody: true })
  @DeprecatedPost()
  getBattleLogLeaderboardViaPost(
    @Body() body: BattleLogLeaderboardInputDto,
  ): Promise<BattleLogLeaderboardDto> {
    return this.getBattleLogLeaderboard(body);
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
    @Query() query: PlayerWarsInputDto,
  ): Promise<AttackHistoryItemsDto> {
    return this.playerWarsService.getAttackHistory({ playerTag, ...query });
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
  ): Promise<AggregateClanWarLeagueHistoryItemsDto> {
    return this.playerWarsService.aggregateClanWarLeagueHistory({
      playerTag,
      startDate: query.startDate,
    });
  }

  @Put('/:playerTag')
  @Roles([UserRoles.ADMIN])
  async addPlayerAccount(@Param('playerTag') playerTag: string): Promise<ResultOkDto> {
    return this.playersService.addPlayer(playerTag);
  }
}
