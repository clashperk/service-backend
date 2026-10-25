import { ClanDto } from '@app/clash-client';
import { Cache, DeprecatedPost } from '@app/decorators';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  QueryMethod,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard, UserRoles } from '../auth';
import { ClanActivityService } from './clan-activity.service';
import { ClansService } from './clans.service';
import {
  CapitalContributionDto,
  CapitalContributionInputDto,
  CapitalRaidsDto,
  CapitalRaidsInputDto,
  ClanActivityDto,
  ClanActivityInputDto,
  ClanGamesDto,
  ClanGamesInputDto,
  ClanLinksDto,
  LastSeenDto,
} from './dto';
import { ApiTag } from '../api-tags';

@ApiTags(ApiTag.CLANS)
@Controller('/clans')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClansController {
  constructor(
    private clansService: ClansService,
    private clanActivityService: ClanActivityService,
  ) {}

  @QueryMethod('/activity')
  @Cache(300)
  async getActivity(@Body() body: ClanActivityInputDto): Promise<ClanActivityDto> {
    return this.clanActivityService.getActivity(body);
  }

  @Post('/activity')
  @HttpCode(200)
  @Cache(300)
  @DeprecatedPost()
  getActivityViaPost(@Body() body: ClanActivityInputDto): Promise<ClanActivityDto> {
    return this.getActivity(body);
  }

  @Get('/:clanTag')
  @Cache(120)
  async getClan(@Param('clanTag') clanTag: string): Promise<ClanDto> {
    return this.clansService.getClan(clanTag);
  }

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

  @Get('/:clanTag/capital-raids')
  @Cache(300)
  async getCapitalRaids(
    @Param('clanTag') clanTag: string,
    @Query() query: CapitalRaidsInputDto,
  ): Promise<CapitalRaidsDto> {
    return this.clansService.getCapitalRaids(clanTag, query.limit);
  }

  @Get('/:clanTag/clan-games')
  @Cache(300)
  async getClanGames(
    @Param('clanTag') clanTag: string,
    @Query() query: ClanGamesInputDto,
  ): Promise<ClanGamesDto> {
    return this.clansService.getClanGames(clanTag, query.season);
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
