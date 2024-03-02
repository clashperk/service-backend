import { JwtAuthGuard } from '@app/auth';
import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { ReorderCategoriesInput } from './dto/update-clan-categories.dto';
import { GuildsService } from './guilds.service';

@ApiTags('GUILDS')
@Controller('/guilds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @Get('/:guildId/clans')
  getGuildMembers(@Param('guildId') guildId: string, @Query('q') q: string) {
    return this.guildsService.getMembers(guildId, q);
  }

  @Get('/:guildId/clans')
  getClans(@Param('guildId') guildId: string) {
    return this.guildsService.getClans(guildId);
  }

  @Get('/:guildId/clans-and-categories')
  getClansWithCategories(@Param('guildId') guildId: string) {
    return this.guildsService.getClans(guildId);
  }

  @Put('/:guildId/reorder-clans')
  @ApiBody({ type: ReorderCategoriesInput, isArray: true })
  updateClansAndCategories(@Param('guildId') guildId: string, @Body() _: ReorderCategoriesInput[]) {
    return this.guildsService.getClans(guildId);
  }
}
