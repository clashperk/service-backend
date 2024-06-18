import { CurrentUser } from '@app/auth';
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ClansService } from './clans.service';
import { CWLStatsOutput } from './dto/cwl-stats.dto';
import { PaginationInput } from './dto/pagination.dto';
import { SeasonInput } from './dto/season-input.dto';

@ApiTags('CLANS')
@ApiBearerAuth()
@Controller('/clans')
// @UseGuards(JwtAuthGuard, RolesGuard)
export class ClansController {
  constructor(private clansService: ClansService) {}

  @Get('/:clanTag/capital-raids')
  getCapitalRaids(@Param('clanTag') clanTag: string, @Query() pagination: PaginationInput) {
    return this.clansService.getCapitalRaids(clanTag, pagination.limit);
  }

  @Get('/:clanTag/capital-contribution')
  getCapitalContribution(@Param('clanTag') clanTag: string, @Query() filter: SeasonInput) {
    return this.clansService.getCapitalContributions(clanTag, filter.season);
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

  @Get('/:clanTag/badges/:size')
  @ApiResponse({ type: CWLStatsOutput, status: 200 })
  async getClanBadges(
    @Param('clanTag') clanTag: string,
    @Param('size') size: string,
    @Res() res: Response,
  ) {
    const buffer = await this.clansService.getClanBadges(clanTag, size);
    res.setHeader('Content-Type', 'image/png');
    return res.send(Buffer.from(buffer));
  }
}
