import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard, UserRoles } from '../auth';
import { GuildClansDto, ListMemberDto, ReorderClanCategoriesInput } from './dto';
import { GuildsService } from './guilds.service';

@Controller('/guilds')
@ApiBearerAuth()
@Roles([UserRoles.USER])
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @Get('/:guildId/clans')
  async getGuildClans(@Param('guildId') guildId: string): Promise<GuildClansDto> {
    return this.guildsService.getGuildClans(guildId);
  }

  @Patch('/:guildId/clans/reorder')
  async reorderGuildClans(
    @Param('guildId') guildId: string,
    @Body() body: ReorderClanCategoriesInput,
  ): Promise<GuildClansDto> {
    return this.guildsService.reorderGuildClans({ categories: body.categories, guildId });
  }

  @Get('/:guildId/members/list')
  async listMembers(
    @Param('guildId') guildId: string,
    @Query('query') query: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ListMemberDto[]> {
    return this.guildsService.listMembers({
      guildId,
      query,
      applicationId: user.applicationId || null,
    });
  }
}
