import { Cache } from '@app/decorators';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { ClanWarLeaguesDto } from './dto';
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
}
