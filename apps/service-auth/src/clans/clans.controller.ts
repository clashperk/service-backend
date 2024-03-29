import { CurrentUser, JwtAuthGuard, RolesGuard } from '@app/auth';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClansService } from './clans.service';
import { CWLStatsOutput } from './dto/cwl-stats.dto';
import { PaginationInput } from './dto/pagination.dto';

@ApiTags('CLANS')
@ApiBearerAuth()
@Controller('/clans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClansController {
  constructor(private clansService: ClansService) {}

  @Get('/:clanTag/capital-raids')
  getCapitalRaids(@Param('clanTag') clanTag: string, @Query() pagination: PaginationInput) {
    return this.clansService.getCapitalRaids(clanTag, pagination.limit);
  }

  @Get('/:clanTag/capital-contribution')
  getCapitalContribution(@Param('clanTag') clanTag: string) {
    return this.clansService.getCapitalContributions(clanTag);
  }

  @Get('/:clanTag/links')
  getLinkedMembers(@CurrentUser() userId: string, @Param('clanTag') clanTag: string) {
    return this.clansService.getLinkedMembers(userId, clanTag);
  }

  @Get('/:clanTag/wars/:warId')
  getClanWar(@Param('clanTag') clanTag: string, @Param('warId') warId: string) {
    return this.clansService.getClanWar(clanTag, warId);
  }

  @Get('/:clanTag/cwl-stats')
  @ApiResponse({ type: CWLStatsOutput, status: 200 })
  getCwlStats(@Param('clanTag') clanTag: string) {
    return this.clansService.getCWLStats(clanTag);
  }
}
