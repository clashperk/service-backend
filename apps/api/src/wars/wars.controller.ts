import { Cache } from '@app/decorators';
import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import {
  ClanWarDto,
  ClanWarLeagueSeasonsDto,
  ClanWarLeagueSeasonsInputDto,
  ClanWarLeagueStandingsDto,
  ClanWarLeaguesDto,
  ClanWarListDto,
  ClanWarListInputDto,
  ClanWarStatsDto,
  ClanWarStatsInputDto,
  CurrentWarDto,
} from './dto';
import { WarsService } from './wars.service';
import { ApiTag } from '../api-tags';

@ApiTags(ApiTag.WARS)
@Controller('/wars')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WarsController {
  constructor(private warsService: WarsService) {}

  @Get('/:clanTag/clan-war-leagues/groups')
  @Cache(60 * 5)
  async getClanWarLeagueGroups(@Param('clanTag') clanTag: string): Promise<ClanWarLeaguesDto> {
    return this.warsService.getClanWarLeagueGroups(clanTag);
  }

  @Get('/:clanTag/clan-war-leagues/clan')
  @Cache(60 * 5)
  async getClanWarLeagueForClan(@Param('clanTag') clanTag: string): Promise<ClanWarLeaguesDto> {
    return this.warsService.getClanWarLeagueForClan(clanTag);
  }

  @Get('/:clanTag/clan-war-leagues/seasons')
  @Cache(60 * 5)
  async getClanWarLeagueSeasons(
    @Param('clanTag') clanTag: string,
    @Query() query: ClanWarLeagueSeasonsInputDto,
  ): Promise<ClanWarLeagueSeasonsDto> {
    return this.warsService.getClanWarLeagueSeasons({ clanTag, limit: query.limit });
  }

  @Get('/:clanTag/members/stats')
  @Cache(60 * 5)
  async getClanWarStats(
    @Param('clanTag') clanTag: string,
    @Query() query: ClanWarStatsInputDto,
  ): Promise<ClanWarStatsDto> {
    return this.warsService.getClanWarStats({ clanTag, ...query });
  }

  @Get('/:clanTag/clan-war-leagues/groups/:groupId/standings')
  @Cache(60 * 5)
  async getClanWarLeagueStandings(
    @Param('clanTag') clanTag: string,
    @Param('groupId', ParseIntPipe) groupId: number,
  ): Promise<ClanWarLeagueStandingsDto> {
    return this.warsService.getClanWarLeagueStandings({ clanTag, groupId });
  }

  @Get('/:clanTag')
  @Cache(60)
  async getClanWars(
    @Param('clanTag') clanTag: string,
    @Query() query: ClanWarListInputDto,
  ): Promise<ClanWarListDto> {
    return this.warsService.getClanWars({ clanTag, limit: query.limit, before: query.before });
  }

  @Get('/:clanTag/current')
  @Cache(60)
  async getCurrentWar(@Param('clanTag') clanTag: string): Promise<CurrentWarDto> {
    return this.warsService.getCurrentWar(clanTag);
  }

  @Get('/:clanTag/:warId')
  @Cache(60 * 5)
  async getClanWar(
    @Param('clanTag') clanTag: string,
    @Param('warId') warId: string,
  ): Promise<ClanWarDto> {
    return this.warsService.getClanWar({ clanTag, warId });
  }
}
