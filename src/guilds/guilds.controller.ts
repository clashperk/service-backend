import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { GuildsService } from './guilds.service';

@Controller('/guilds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @Get('/:guildId/settings')
  async getGuildSettings(@Param('guildId') guildId: string) {
    return this.guildsService.getClans(guildId);
  }
}
