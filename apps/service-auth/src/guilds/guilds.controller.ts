import { JwtAuthGuard } from '@app/auth';
import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReorderCategoriesInput } from './dto/update-clan-categories.dto';
import { GuildsService } from './guilds.service';

@ApiTags('GUILDS')
@Controller('/guilds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @Get('/:guildId/members')
  @ApiOperation({ summary: '(Internal)' })
  getGuildMembers(@Param('guildId') guildId: string, @Query('q') q: string) {
    return this.guildsService.getMembers(guildId, q);
  }

  @Get('/:guildId')
  @ApiOperation({ summary: '(Internal)' })
  getGuild(@Param('guildId') guildId: string) {
    return this.guildsService.getGuild(guildId);
  }

  @Put('/:guildId/reorder-clans')
  @ApiOperation({ summary: '(Internal)' })
  @ApiBody({ type: ReorderCategoriesInput, isArray: true })
  updateClansAndCategories(@Param('guildId') guildId: string, @Body() _: ReorderCategoriesInput[]) {
    return this.guildsService.getGuild(guildId);
  }
}
