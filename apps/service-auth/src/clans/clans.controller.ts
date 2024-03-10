import { CurrentUser, JwtAuthGuard, RolesGuard } from '@app/auth';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClansService } from './clans.service';

@ApiTags('CLANS')
@ApiBearerAuth()
@Controller('/clans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClansController {
  constructor(private clansService: ClansService) {}

  @Get('/:clanTag/capital-contribution')
  getCapitalContribution(@Param('clanTag') clanTag: string) {
    return this.clansService.getCapitalContributions(clanTag);
  }

  @Get('/:clanTag/linked-members')
  getLinkedMembers(@CurrentUser() userId: string, @Param('clanTag') clanTag: string) {
    return this.clansService.getLinkedMembers(userId, clanTag);
  }

  @Get('/:clanTag/wars/:warId')
  getClanWar(@Param('clanTag') clanTag: string, @Param('warId') warId: string) {
    return this.clansService.getClanWar(clanTag, warId);
  }

  @Get('/:clanTag/cwl-stats')
  getCwlStats(@Param('clanTag') clanTag: string) {
    return this.clansService.getCWLStats(clanTag);
  }
}
