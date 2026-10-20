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

@Injectable()
export class DiscordOauthService {
  private logger = new Logger(DiscordOauthService.name);
  // One client per bot token: discord.js only queues for Discord's rate limits within a client.
  private clients = new Map<string, REST>();
  private webhooks = new REST({ version: '10' });

  constructor(private configService: ConfigService) {}

  /** The shared client for a custom bot's token, or ClashPerk's own when null. */
  private bot(token: string | null) {
    const key = token ?? this.configService.getOrThrow<string>('DISCORD_TOKEN');
    let client = this.clients.get(key);
    if (!client) {
      client = new REST({ version: '10' }).setToken(key);
      this.clients.set(key, client);
    }
    return client;
  }

  async getUser(userId: string): Promise<APIUser> {
    try {
      return (await this.bot(null).get(Routes.user(userId))) as APIUser;
    } catch (error) {
      throw new HttpException(error.message, error.status ?? 500);
    }
  }

  async listMembers(input: {
    guildId: string;
    query: string;
    token: string | null;
  }): Promise<APIGuildMember[]> {
    const payload = await this.bot(input.token).get(Routes.guildMembersSearch(input.guildId), {
      query: new URLSearchParams({ query: input.query, limit: '50' }),
    });
    return payload as APIGuildMember[];
  }

  async getGuild(input: {
    guildId: string;
    token: string | null;
    withCounts?: boolean;
  }): Promise<APIGuild> {
    const payload = await this.bot(input.token).get(Routes.guild(input.guildId), {
      query: new URLSearchParams(input.withCounts ? { with_counts: 'true' } : {}),
    });

    return payload as APIGuild;
  }

  async listChannels(input: { guildId: string; token: string | null }): Promise<APIChannel[]> {
    const payload = await this.bot(input.token).get(Routes.guildChannels(input.guildId));

    return payload as APIChannel[];
  }

  /** The bot's own member record in a server, for its roles. */
  async getBotMember(input: { guildId: string; token: string | null }) {
    const rest = this.bot(input.token);
    const me = (await rest.get(Routes.user('@me'))) as APIUser;
    return (await rest.get(Routes.guildMember(input.guildId, me.id))) as APIGuildMember;
  }

  /** A member of a server; null when they aren't in it or the bot isn't. */
  async getMember(input: { guildId: string; userId: string; token: string | null }) {
    try {
      return (await this.bot(input.token).get(
        Routes.guildMember(input.guildId, input.userId),
      )) as APIGuildMember;
    } catch (error) {
      if ([403, 404].includes(error.status)) return null;
      throw new HttpException(error.message, error.status ?? 500);
    }
  }

  /** Active threads, forum posts included; Discord leaves archived ones out. */
  async listActiveThreads(input: { guildId: string; token: string | null }) {
    const payload = (await this.bot(input.token).get(Routes.guildActiveThreads(input.guildId))) as {
      threads: APIChannel[];
    };
    return payload.threads;
  }

  /** One channel or thread by ID; null when it's gone or the bot can't see it. */
  async getChannel(input: { channelId: string; token: string | null }) {
    const result = await this.findChannel(input);
    return 'channel' in result ? result.channel : null;
  }

  /** Like `getChannel`, but says whether a missing channel is deleted or hidden from the bot. */
  async findChannel(input: {
    channelId: string;
    token: string | null;
  }): Promise<{ channel: APIChannel } | { missing: 'deleted' | 'noAccess' }> {
    try {
      return {
        channel: (await this.bot(input.token).get(Routes.channel(input.channelId))) as APIChannel,
      };
    } catch (error) {
      if (error.status === 404) return { missing: 'deleted' };
      if (error.status === 403) return { missing: 'noAccess' };
      throw new HttpException(error.message, error.status ?? 500);
    }
  }

  /** A webhook by its token, which needs no bot access; null when it no longer exists. */
  async getWebhook(input: { id: string; token: string }): Promise<APIWebhook | null> {
    try {
      return (await this.webhooks.get(Routes.webhook(input.id, input.token), {
        auth: false,
      })) as APIWebhook;
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
