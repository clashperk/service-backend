import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth';
import { GuildsService } from './guilds.service';

@Controller('/guilds')
@ApiSecurity('apiKey')
@UseGuards(ApiKeyGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @Get('/:guildId/settings')
  async getGuildSettings(@Param('guildId') guildId: string) {
    return this.guildsService.getClans(guildId);
  }
}
