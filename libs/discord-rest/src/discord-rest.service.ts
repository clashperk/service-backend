import { ErrorCodes } from '@app/dto';
import { DiscordAPIError, REST } from '@discordjs/rest';
import { ForbiddenException, HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APIChannel,
  APIGuild,
  APIGuildMember,
  APIUser,
  APIWebhook,
  RESTJSONErrorCodes,
  Routes,
} from 'discord-api-types/v10';
import { URLSearchParams } from 'url';

// What Discord answers on a server's routes when the bot was never added or has been removed.
const NOT_IN_SERVER: number[] = [RESTJSONErrorCodes.UnknownGuild, RESTJSONErrorCodes.MissingAccess];

/** The bot can't see the server, so nothing in it can be read or managed. */
export class BotNotInGuildException extends ForbiddenException {
  constructor() {
    super(
      ErrorCodes.BOT_NOT_IN_GUILD,
      "ClashPerk isn't in this server any more. Invite it again to manage the server.",
    );
  }
}

@Injectable()
export class DiscordRestService {
  private logger = new Logger(DiscordRestService.name);
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

  /** A request on one of a server's routes, with "not in this server" as `BotNotInGuildException`. */
  private async inServer<T>(request: Promise<unknown>): Promise<T> {
    try {
      return (await request) as T;
    } catch (error) {
      if (error instanceof DiscordAPIError && NOT_IN_SERVER.includes(Number(error.code))) {
        throw new BotNotInGuildException();
      }
      throw error;
    }
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
    return this.inServer<APIGuildMember[]>(
      this.bot(input.token).get(Routes.guildMembersSearch(input.guildId), {
        query: new URLSearchParams({ query: input.query, limit: '50' }),
      }),
    );
  }

  /** Every member of a server, 1,000 per request; needs the Server Members intent. */
  async listAllMembers(input: { guildId: string; token: string | null }) {
    const rest = this.bot(input.token);
    const members: APIGuildMember[] = [];
    let after = '0';
    for (;;) {
      const page = await this.inServer<APIGuildMember[]>(
        rest.get(Routes.guildMembers(input.guildId), {
          query: new URLSearchParams({ limit: '1000', after }),
        }),
      );
      members.push(...page);
      if (page.length < 1000) return members;
      after = page[page.length - 1].user.id;
    }
  }

  async getGuild(input: {
    guildId: string;
    token: string | null;
    withCounts?: boolean;
  }): Promise<APIGuild> {
    return this.inServer<APIGuild>(
      this.bot(input.token).get(Routes.guild(input.guildId), {
        query: new URLSearchParams(input.withCounts ? { with_counts: 'true' } : {}),
      }),
    );
  }

  async listChannels(input: { guildId: string; token: string | null }): Promise<APIChannel[]> {
    return this.inServer<APIChannel[]>(
      this.bot(input.token).get(Routes.guildChannels(input.guildId)),
    );
  }

  /** The bot's own member record in a server, for its roles. */
  async getBotMember(input: { guildId: string; token: string | null }) {
    const rest = this.bot(input.token);
    const me = (await rest.get(Routes.user('@me'))) as APIUser;
    return this.inServer<APIGuildMember>(rest.get(Routes.guildMember(input.guildId, me.id)));
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
    const payload = await this.inServer<{ threads: APIChannel[] }>(
      this.bot(input.token).get(Routes.guildActiveThreads(input.guildId)),
    );
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
