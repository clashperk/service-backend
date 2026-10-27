import { Cache } from '@app/decorators';
import { Body, Controller, Get, Param, Query, QueryMethod, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiTag } from '../api-tags';
import { JwtAuthGuard } from '../auth';
import {
  ClanRankingsDto,
  PlayerRankingsDto,
  RankingBoardDto,
  RankingBoardParamsDto,
  RankingBoardQueryDto,
  RankingLocationsDto,
  RankingSeasonsDto,
  RankingStandingsDto,
  RankingStandingsInputDto,
} from './dto';
import { RankingsService } from './rankings.service';

@ApiTags(ApiTag.RANKINGS)
@Controller('/rankings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class RankingsController {
  constructor(private rankingsService: RankingsService) {}

  @Get('/locations')
  @Cache(86400)
  async getLocations(): Promise<RankingLocationsDto> {
    return { items: await this.rankingsService.getLocations() };
  }

  @Get('/seasons')
  @Cache(3600)
  async getSeasons(): Promise<RankingSeasonsDto> {
    return { items: await this.rankingsService.getSeasons() };
  }

  @QueryMethod('/standings')
  @Cache(300)
  async getStandings(@Body() body: RankingStandingsInputDto): Promise<RankingStandingsDto> {
    return { items: await this.rankingsService.getStandings(body) };
  }

  @Get('/clans/:clanTag')
  @Cache(300)
  getClanRankings(@Param('clanTag') clanTag: string): Promise<ClanRankingsDto> {
    return this.rankingsService.getClanRankings(clanTag);
  }

  @Get('/players/:playerTag')
  @Cache(300)
  async getPlayerRankings(@Param('playerTag') playerTag: string): Promise<PlayerRankingsDto> {
    return { items: await this.rankingsService.getPlayerRankings(playerTag) };
  }

  @Get('/:countryCode/:board')
  @Cache(300)
  getBoard(
    @Param() { countryCode, board }: RankingBoardParamsDto,
    @Query() { season }: RankingBoardQueryDto,
  ): Promise<RankingBoardDto> {
    return this.rankingsService.getBoard(countryCode, board, season);
  }
}
