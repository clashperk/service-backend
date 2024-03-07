import { JwtAuthGuard, Role, Roles, RolesGuard } from '@app/auth';
import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GuildOutput, ReorderClanCategoriesInput } from './dto';
import { GuildsService } from './guilds.service';

@ApiTags('GUILDS')
@Controller('/guilds')
@ApiBearerAuth()
@Roles(Role.USER)
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @Get('/:guildId/members')
  @ApiOperation({ summary: '(Internal)' })
  getGuildMembers(@Param('guildId') guildId: string, @Query('q') q: string) {
    return this.guildsService.getMembers(guildId, q);
  }

  @Get('/:guildId')
  @ApiOperation({ summary: '(Internal)' })
  @ApiResponse({ type: GuildOutput, status: 200 })
  getGuild(@Param('guildId') guildId: string): Promise<GuildOutput> {
    return this.guildsService.getGuild(guildId);
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
