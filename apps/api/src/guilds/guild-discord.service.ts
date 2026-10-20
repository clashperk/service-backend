import { DiscordRestService } from '@app/discord-rest';
import { cached, mapLimit } from '@app/helpers';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { APIChannel, ChannelType } from 'discord-api-types/v10';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import {
  byPosition,
  ChannelLookup,
  ChannelState,
  describeChannel,
  missingChannel,
  parentOf,
  POSTABLE_CHANNELS,
  THREAD_PARENTS,
  THREADS,
} from './discord-channels';
import { GuildChannelDto, GuildRoleDto } from './dto';

const REMINDER_COLLECTIONS = [
  Collections.CLAN_WAR_REMINDERS,
  Collections.CAPITAL_RAID_REMINDERS,
  Collections.CLAN_GAMES_REMINDERS,
] as const;

// A page load asks for the channel list several times.
const SERVER_CHANNELS_TTL = 10 * 1000;
// Deleted channels answer 404, and too many failed requests get the bot's IP blocked by Discord.
const LOOKUP_TTL = 5 * 60 * 1000;
const LOOKUP_CONCURRENCY = 3;
const MAX_LOOKUPS = 25;

export type Webhook = { id: string; token: string };
type ServerChannels = { channels: APIChannel[]; threads: APIChannel[] };

/** The server's channels, roles and ClashPerk webhooks, shared by reminders and clan logs. */
@Injectable()
export class GuildDiscordService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discordRest: DiscordRestService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** The server's channels and active threads, as Discord lists them. */
  private serverChannels(guildId: string, applicationId: string | null) {
    const key = `discord:server-channels:${guildId}:${applicationId ?? 'clashperk'}`;
    return cached<ServerChannels>(this.cache, key, SERVER_CHANNELS_TTL, async () => {
      const token = await this.botToken(applicationId);
      const [channels, threads] = await Promise.all([
        this.discordRest.listChannels({ guildId, token }),
        this.discordRest.listActiveThreads({ guildId, token }),
      ]);
      return { channels, threads };
    });
  }

  /** Channels in Discord's order, each followed by its active threads or forum posts. */
  async listChannels(input: {
    guildId: string;
    applicationId: string | null;
  }): Promise<GuildChannelDto[]> {
    const { channels, threads } = await this.serverChannels(input.guildId, input.applicationId);
    const webhooks = await this.knownWebhooks(input.guildId, threads);

    const threadsByParent = new Map<string, APIChannel[]>();
    for (const thread of threads.filter((thread) => THREADS.includes(thread.type))) {
      const parentId = parentOf(thread);
      if (parentId)
        threadsByParent.set(parentId, [...(threadsByParent.get(parentId) ?? []), thread]);
    }

    const result: GuildChannelDto[] = [];
    const parents = channels
      .filter((channel) => THREAD_PARENTS.includes(channel.type))
      .sort(byPosition);
    for (const channel of parents) {
      const postable = POSTABLE_CHANNELS.includes(channel.type);
      const children = (threadsByParent.get(channel.id) ?? []).sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? ''),
      );
      if (!postable && !children.length) continue;
      result.push({
        id: channel.id,
        name: channel.name ?? channel.id,
        type: channel.type,
        parentId: parentOf(channel),
        selectable: postable,
        hasWebhook: webhooks.has(channel.id),
      });
      for (const thread of children) {
        result.push({
          id: thread.id,
          name: thread.name ?? thread.id,
          type: thread.type,
          parentId: channel.id,
          selectable: true,
          hasWebhook: webhooks.has(channel.id),
        });
      }
    }
    return result;
  }

  async listRoles(input: {
    guildId: string;
    applicationId: string | null;
  }): Promise<GuildRoleDto[]> {
    const guild = await this.discordRest.getGuild({
      guildId: input.guildId,
      token: await this.botToken(input.applicationId),
    });
    // @everyone shares the server's ID; managed roles belong to bots and integrations.
    return guild.roles
      .filter((role) => role.id !== input.guildId && !role.managed)
      .map((role) => ({ id: role.id, name: role.name, color: role.color, position: role.position }))
      .sort((a, b) => b.position - a.position);
  }

  async memberCount(guildId: string, applicationId: string | null) {
    const guild = await this.discordRest.getGuild({
      guildId,
      token: await this.botToken(applicationId),
      withCounts: true,
    });
    return guild.approximate_member_count ?? 0;
  }

  /** The bot posts wherever the record says, so the channel must be one of this server's. */
  async checkChannel(guildId: string, applicationId: string | null, channelId: string) {
    const channels = await this.listChannels({ guildId, applicationId });
    if (!channels.some((channel) => channel.id === channelId && channel.selectable)) {
      throw new BadRequestException(
        'Pick a text or announcement channel, or a thread, in this server.',
      );
    }
  }

  /** Roles the bot can give out: in the server, not @everyone or managed, and not above its highest role. */
  async checkAssignableRoles(guildId: string, applicationId: string | null, roleIds: string[]) {
    if (!roleIds.length) return;
    const token = await this.botToken(applicationId);
    const [guild, me] = await Promise.all([
      this.discordRest.getGuild({ guildId, token }),
      this.discordRest.getBotMember({ guildId, token }),
    ]);
    const roles = new Map(guild.roles.map((role) => [role.id, role]));
    const highest = Math.max(0, ...me.roles.map((id) => roles.get(id)?.position ?? 0));
    for (const roleId of new Set(roleIds)) {
      const role = roles.get(roleId);
      if (!role) throw new BadRequestException('Pick roles in this server.');
      if (role.id === guildId || role.managed) {
        throw new BadRequestException(
          `${role.name} can't be given out: it's @everyone or managed by a bot or integration.`,
        );
      }
      if (role.position > highest) {
        throw new BadRequestException(
          `ClashPerk can't give out ${role.name}: move ClashPerk's role above it in Server Settings › Roles.`,
        );
      }
    }
  }

  async checkRole(guildId: string, applicationId: string | null, roleId: string) {
    const roles = await this.listRoles({ guildId, applicationId });
    if (!roles.some((role) => role.id === roleId)) {
      throw new BadRequestException('Pick a role in this server.');
    }
  }

  /**
   * Threads post through their parent channel's webhook. One from Discord's sign-in must be in
   * that channel; otherwise reuse one ClashPerk already has there.
   */
  async resolveWebhook(
    guildId: string,
    applicationId: string | null,
    channelId: string,
    provided: Webhook | undefined,
  ): Promise<Webhook | null> {
    const channel = await this.discordRest.getChannel({
      channelId,
      token: await this.botToken(applicationId),
    });
    const homeId = (channel && THREADS.includes(channel.type) && parentOf(channel)) || channelId;
    if (provided) {
      const webhook = await this.discordRest.getWebhook(provided);
      if (!webhook || webhook.guild_id !== guildId || webhook.channel_id !== homeId) {
        throw new BadRequestException("That webhook isn't in the chosen channel.");
      }
      return { id: provided.id, token: provided.token };
    }
    // Without a webhook the bot creates one in the channel the first time it posts.
    const threads = channel && homeId !== channelId ? [channel] : [];
    return (await this.knownWebhooks(guildId, threads)).get(homeId) ?? null;
  }

  /** The IDs of members holding each role. */
  async roleMembers(guildId: string, applicationId: string | null, roleIds: string[]) {
    const members = await this.discordRest.listAllMembers({
      guildId,
      token: await this.botToken(applicationId),
    });
    return new Map(
      roleIds.map((roleId) => [
        roleId,
        members.filter((member) => member.roles.includes(roleId)).map((member) => member.user.id),
      ]),
    );
  }

  /** Category channels, where the bot opens and moves ticket channels. */
  async listCategories(input: { guildId: string; applicationId: string | null }) {
    const { channels } = await this.serverChannels(input.guildId, input.applicationId);
    return channels
      .filter((channel) => channel.type === ChannelType.GuildCategory)
      .sort(byPosition)
      .map((channel) => ({ id: channel.id, name: channel.name ?? channel.id }));
  }

  /** Name, thread parent and whether ClashPerk can post there, for each saved channel. */
  async channelStatuses(
    guildId: string,
    applicationId: string | null,
    channelIds: string[],
  ): Promise<Map<string, ChannelState>> {
    const ids = [...new Set(channelIds)];
    if (!ids.length) return new Map();
    const channels = await this.serverChannels(guildId, applicationId)
      .then(({ channels, threads }) => new Map([...channels, ...threads].map((c) => [c.id, c])))
      .catch(() => null);
    if (!channels) return new Map(ids.map((id) => [id, missingChannel(null)]));

    // Archived threads aren't listed, so they and deleted channels are looked up one by one.
    const lookups = await this.lookUpChannels(
      ids.filter((id) => !channels.has(id)),
      applicationId,
    );
    for (const [id, lookup] of lookups) {
      if (lookup && 'channel' in lookup && inGuild(lookup.channel, guildId)) {
        channels.set(id, lookup.channel);
      }
    }
    return new Map(
      ids.map((id) => {
        const channel = channels.get(id);
        return [id, channel ? describeChannel(channel, channels) : missingChannel(lookups.get(id))];
      }),
    );
  }

  /** Up to `MAX_LOOKUPS` channels by ID; a null result means Discord didn't answer. */
  private async lookUpChannels(ids: string[], applicationId: string | null) {
    const token = await this.botToken(applicationId);
    const results = await mapLimit(ids.slice(0, MAX_LOOKUPS), LOOKUP_CONCURRENCY, (channelId) =>
      cached(this.cache, `discord:channel:${channelId}`, LOOKUP_TTL, () =>
        this.discordRest.findChannel({ channelId, token }),
      ).catch((): ChannelLookup | null => null),
    );
    return new Map(results.map((result, index) => [ids[index], result]));
  }

  /** Webhooks ClashPerk already posts through in this server, by the channel that owns them. */
  private async knownWebhooks(guildId: string, threads: APIChannel[]) {
    const [reminders, logs] = await Promise.all([
      Promise.all(
        REMINDER_COLLECTIONS.map((collection) =>
          this.db
            .collection(collection)
            .find(
              { guild: guildId, webhook: { $ne: null } },
              { projection: { channel: 1, webhook: 1 } },
            )
            .toArray(),
        ),
      ),
      this.db
        .collection(Collections.CLAN_LOGS)
        .find({ guildId, webhook: { $ne: null } }, { projection: { channelId: 1, webhook: 1 } })
        .toArray(),
    ]);
    // A record in a thread holds its parent's webhook.
    const homes = new Map(threads.map((thread) => [thread.id, parentOf(thread) ?? thread.id]));
    const byChannel = new Map<string, Webhook>();
    const records = [
      ...reminders.flat().map(({ channel, webhook }) => ({ channelId: channel, webhook })),
      ...logs.map(({ channelId, webhook }) => ({ channelId, webhook })),
    ];
    for (const { channelId, webhook } of records) {
      if (!webhook) continue;
      byChannel.set(homes.get(channelId) ?? channelId, { id: webhook.id, token: webhook.token });
    }
    return byChannel;
  }

  private async botToken(applicationId: string | null) {
    if (!applicationId) return null;
    const bot = await this.db
      .collection(Collections.CUSTOM_BOTS)
      .findOne({ serviceId: applicationId });
    return bot?.token ?? null;
  }
}

const inGuild = (channel: APIChannel, guildId: string) =>
  'guild_id' in channel && channel.guild_id === guildId;
