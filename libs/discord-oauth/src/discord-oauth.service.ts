import { REST } from '@discordjs/rest';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APIChannel,
  APIGuild,
  APIGuildMember,
  APIUser,
  APIWebhook,
  Routes,
} from 'discord-api-types/v10';
import { URLSearchParams } from 'url';

const rest = new REST({ version: '10' });

@Injectable()
export class DiscordOauthService {
  private logger = new Logger(DiscordOauthService.name);

  constructor(private configService: ConfigService) {
    rest.setToken(this.configService.getOrThrow('DISCORD_TOKEN'));
  }

  async getUser(userId: string): Promise<APIUser> {
    try {
      return (await rest.get(Routes.user(userId))) as APIUser;
    } catch (error) {
      throw new HttpException(error.message, error.status ?? 500);
    }
  }

  async listMembers(input: {
    guildId: string;
    query: string;
    token: string | null;
  }): Promise<APIGuildMember[]> {
    const rest = new REST({ version: '10' });

    input.token ??= this.configService.getOrThrow<string>('DISCORD_TOKEN');
    rest.setToken(input.token);

    const payload = await rest.get(Routes.guildMembersSearch(input.guildId), {
      query: new URLSearchParams({ query: input.query, limit: '50' }),
      headers: {
        Authorization: `Bot ${input.token}`,
      },
    });
    return payload as APIGuildMember[];
  }

  async getGuild(input: { guildId: string; token: string | null }): Promise<APIGuild> {
    const rest = new REST({ version: '10' });

    input.token ??= this.configService.getOrThrow<string>('DISCORD_TOKEN');
    rest.setToken(input.token);

    const payload = await rest.get(Routes.guild(input.guildId), {
      headers: {
        Authorization: `Bot ${input.token}`,
      },
    });

    return payload as APIGuild;
  }

  async listChannels(input: { guildId: string; token: string | null }): Promise<APIChannel[]> {
    const rest = new REST({ version: '10' });

    input.token ??= this.configService.getOrThrow<string>('DISCORD_TOKEN');
    rest.setToken(input.token);

    const payload = await rest.get(Routes.guildChannels(input.guildId), {
      headers: {
        Authorization: `Bot ${input.token}`,
      },
    });

    return payload as APIChannel[];
  }

  /** A webhook by its token, which needs no bot access; null when it no longer exists. */
  async getWebhook(input: { id: string; token: string }): Promise<APIWebhook | null> {
    try {
      return (await new REST({ version: '10', authPrefix: 'Bot' }).get(
        Routes.webhook(input.id, input.token),
        { auth: false },
      )) as APIWebhook;
    } catch (error) {
      if (error.status === 404 || error.status === 401) return null;
      throw new HttpException(error.message, error.status ?? 500);
    }
  }

  public toAvatarUrl(userId: string, avatar: string | null) {
    if (!avatar) {
      return `https://cdn.discordapp.com/embed/avatars/${BigInt(userId) % BigInt(5)}.png`;
    }
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}${avatar.startsWith('a_') ? '.gif' : '.png'}`;
  }
}
