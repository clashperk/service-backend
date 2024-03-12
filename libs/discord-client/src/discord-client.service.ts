import { Injectable } from '@nestjs/common';

import { REST } from '@discordjs/rest';
import { ConfigService } from '@nestjs/config';
import { APIGuildMember, APIUser, Routes } from 'discord-api-types/v10';
import { URLSearchParams } from 'url';

const rest = new REST({ version: '10' });

@Injectable()
export class DiscordClientService {
  constructor(private configService: ConfigService) {
    rest.setToken(configService.getOrThrow('DISCORD_TOKEN'));
  }

  async getUser(userId: string): Promise<APIUser> {
    const payload = await rest.get(Routes.user(userId));
    return payload as APIUser;
  }

  async listMembers({
    guildId,
    query,
    token,
  }: {
    guildId: string;
    query: string;
    token: string | null;
  }): Promise<APIGuildMember[]> {
    token ??= this.configService.getOrThrow('DISCORD_TOKEN');

    const payload = await rest.get(Routes.guildMembersSearch(guildId), {
      query: new URLSearchParams({ query, limit: '50' }),
      headers: {
        Authorization: `Bot ${token}`,
      },
    });
    return payload as APIGuildMember[];
  }
}
