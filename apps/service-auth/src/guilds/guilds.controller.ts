import { JwtAuthGuard, Role, Roles, RolesGuard } from '@app/auth';
import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GuildOutput, GuildRostersOutput, ReorderClanCategoriesInput } from './dto';
import { GuildsService } from './guilds.service';

@ApiTags('GUILDS')
@Controller('/guilds')
@ApiBearerAuth()
@Roles(Role.USER)
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @Get('/:guildId')
  @ApiOperation({ summary: '(Internal)' })
  @ApiResponse({ type: GuildOutput, status: 200 })
  getGuild(@Param('guildId') guildId: string): Promise<GuildOutput> {
    return this.guildsService.getGuild(guildId);
  }

  @Get('/:guildId/rosters')
  @ApiOperation({ summary: '(Internal)' })
  @ApiResponse({ type: GuildRostersOutput, status: 200 })
  async getGuildRosters(@Param('guildId') guildId: string): Promise<GuildRostersOutput> {
    const [rosters, categories] = await Promise.all([
      this.guildsService.getRosters(guildId),
      this.guildsService.getRosterMemberGroups(guildId),
    ]);

    return { rosters, categories };
  }

  @Get('/:guildId/members')
  @ApiOperation({ summary: '(Internal)' })
  getGuildMembers(@Param('guildId') guildId: string, @Query('q') q: string) {
    return this.guildsService.getMembers(guildId, q);
  }

  @Put('/:guildId/clans/reorder')
  @ApiOperation({ summary: '(Internal)' })
  @ApiResponse({ type: GuildOutput, status: 200 })
  @ApiBody({ type: ReorderClanCategoriesInput })
  reorderClanCategories(
    @Param('guildId') guildId: string,
    @Body() input: ReorderClanCategoriesInput,
  ) {
    return this.guildsService.reorderClanCategories(guildId, input);
  }
}
