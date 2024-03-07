import { JwtAuthGuard, RolesGuard } from '@app/auth';
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
    return this.clansService.getCapitalContribution(clanTag);
  }

  @Get('/:clanTag/linked-members')
  getLinkedMembers(@Param('clanTag') clanTag: string) {
    return this.clansService.getCapitalContribution(clanTag);
  }

  @Get('/:clanTag/wars/:warId')
  getClanWar(@Param('clanTag') clanTag: string, @Param('warId') warId: string) {
    return this.clansService.getClanWar(clanTag, warId);
  }
}
