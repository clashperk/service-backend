import { Cache } from '@app/decorators';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { ClanWarDto, ClanWarLeaguesDto, CurrentWarDto } from './dto';
import { WarsService } from './wars.service';

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
