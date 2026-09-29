import { Cache } from '@app/decorators';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard, UserRoles } from '../auth';
import { ClansService } from './clans.service';
import {
  CapitalContributionDto,
  CapitalContributionInputDto,
  ClanLinksDto,
  LastSeenDto,
} from './dto';

@Controller('/clans')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClansController {
  constructor(private clansService: ClansService) {}

  @Get('/:clanTag/lastseen')
  @Cache(600)
  async getLastSeen(@Param('clanTag') clanTag: string): Promise<LastSeenDto> {
    return this.clansService.getLastSeen(clanTag);
  }

  @Get('/:clanTag/capital-contribution')
  @Cache(300)
  async getCapitalContribution(
    @Param('clanTag') clanTag: string,
    @Query() query: CapitalContributionInputDto,
  ): Promise<CapitalContributionDto> {
    return this.clansService.getCapitalContribution(clanTag, query.season);
  }

  @Get('/:clanTag/links')
  @Roles([UserRoles.USER, UserRoles.MANAGE_LINKS])
  async getClanLinks(
    @CurrentUser() user: JwtUser,
    @Param('clanTag') clanTag: string,
  ): Promise<ClanLinksDto> {
    return this.clansService.getClanLinks(clanTag, user);
  }
}
