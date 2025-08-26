import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards';
import { SettingsEntity } from '../db/entities';
import { GuildsService } from './guilds.service';

@Controller('/guilds')
@ApiSecurity('apiKey')
@UseGuards(ApiKeyGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @Get('/:guildId/settings')
  async getGuildSettings(@Param('guildId') guildId: string): Promise<SettingsEntity> {
    return Promise.resolve(this.guildsService.getSettings(guildId));
  }
}
