import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth';
import { GuildsService } from './guilds.service';

@Controller('/guilds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @Get('/:guildId/clans')
  async getGuildClans(@Param('guildId') guildId: string) {
    return this.guildsService.getClans(guildId);
  }
}
