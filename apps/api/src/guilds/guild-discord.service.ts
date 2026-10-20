import { DiscordOauthService } from '@app/discord-oauth';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { APIChannel, ChannelType } from 'discord-api-types/v10';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { ChannelStatus, GuildChannelDto, GuildRoleDto } from './dto';

const POSTABLE_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
// Forum and media channels can't take messages, only their posts (threads) can.
const THREAD_PARENTS = [...POSTABLE_CHANNELS, ChannelType.GuildForum, ChannelType.GuildMedia];
const THREADS = [
  ChannelType.AnnouncementThread,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
];

const REMINDER_COLLECTIONS = [
  Collections.CLAN_WAR_REMINDERS,
  Collections.CAPITAL_RAID_REMINDERS,
  Collections.CLAN_GAMES_REMINDERS,
] as const;

export type Webhook = { id: string; token: string };
type ChannelLookup = Awaited<ReturnType<DiscordOauthService['findChannel']>>;

// Unlisted channels looked up per request; more show as unknown rather than flooding Discord.
const MAX_LOOKUPS = 25;
const CHANNEL_LOOKUP_TTL = 5 * 60 * 1000;

/** Runs `fn` over `items` with at most `limit` calls in flight, keeping their order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export type ChannelInfo = { name: string | null; status: ChannelStatus; parentName: string | null };

const parentOf = (channel: APIChannel) =>
  'parent_id' in channel ? (channel.parent_id ?? null) : null;

/** The server's channels, roles and ClashPerk webhooks, shared by reminders and clan logs. */
@Injectable()
export class GuildDiscordService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discordOauthService: DiscordOauthService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Channels in Discord's order, each followed by its active threads or forum posts. */
  async listChannels(input: {
    guildId: string;
    applicationId: string | null;
  }): Promise<GuildChannelDto[]> {
    const token = await this.botToken(input.applicationId);
    const [channels, threads] = await Promise.all([
      this.discordOauthService.listChannels({ guildId: input.guildId, token }),
      this.discordOauthService.listActiveThreads({ guildId: input.guildId, token }),
    ]);
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
      .sort((a, b) => ('position' in a ? a.position : 0) - ('position' in b ? b.position : 0));
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
    const guild = await this.discordOauthService.getGuild({
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
    const guild = await this.discordOauthService.getGuild({
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
      this.discordOauthService.getGuild({ guildId, token }),
      this.discordOauthService.getBotMember({ guildId, token }),
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
    const channel = await this.discordOauthService.getChannel({
      channelId,
      token: await this.botToken(applicationId),
    });
    const homeId = (channel && THREADS.includes(channel.type) && parentOf(channel)) || channelId;
    if (provided) {
      const webhook = await this.discordOauthService.getWebhook(provided);
      if (!webhook || webhook.guild_id !== guildId || webhook.channel_id !== homeId) {
        throw new BadRequestException("That webhook isn't in the chosen channel.");
      }
      return { id: provided.id, token: provided.token };
    }
    // Without a webhook the bot creates one in the channel the first time it posts.
    const threads = channel && homeId !== channelId ? [channel] : [];
    return (await this.knownWebhooks(guildId, threads)).get(homeId) ?? null;
  }

  /** Category channels, where the bot opens and moves ticket channels. */
  async listCategories(input: { guildId: string; applicationId: string | null }) {
    const channels = await this.discordOauthService.listChannels({
      guildId: input.guildId,
      token: await this.botToken(input.applicationId),
    });
    return channels
      .filter((channel) => channel.type === ChannelType.GuildCategory)
      .sort((a, b) => ('position' in a ? a.position : 0) - ('position' in b ? b.position : 0))
      .map((channel) => ({ id: channel.id, name: channel.name ?? channel.id }));
  }

  /** Names for saved channels; archived threads aren't listed, so they're looked up one by one. */
  /** Name, parent and whether ClashPerk can post there, for each channel or thread. */
  async channelInfo(
    guildId: string,
    applicationId: string | null,
    channelIds: string[],
  ): Promise<Map<string, ChannelInfo>> {
    const info = new Map<string, ChannelInfo>();
    const ids = [...new Set(channelIds)];
    if (!ids.length) return info;
    let token: string | null;
    let byId: Map<string, APIChannel>;
    try {
      token = await this.botToken(applicationId);
      const [channels, threads] = await Promise.all([
        this.discordOauthService.listChannels({ guildId, token }),
        this.discordOauthService.listActiveThreads({ guildId, token }),
      ]);
      byId = new Map([...channels, ...threads].map((channel) => [channel.id, channel]));
    } catch {
      // Without access to the server's channel list, nothing can be checked.
      for (const id of ids)
        info.set(id, { name: null, status: ChannelStatus.UNKNOWN, parentName: null });
      return info;
    }
    // Archived threads aren't in either list, so each one is looked up on its own: a few at a
    // time, and cached, since lookups of deleted channels count toward Discord's invalid-request ban.
    const unlisted = ids.filter((id) => !byId.has(id));
    const lookups = await mapLimit(unlisted.slice(0, MAX_LOOKUPS), 3, async (channelId) => ({
      channelId,
      result: await this.lookUpChannel(channelId, token),
    }));
    for (const channelId of unlisted.slice(MAX_LOOKUPS)) {
      info.set(channelId, { name: null, status: ChannelStatus.UNKNOWN, parentName: null });
    }
    for (const { channelId, result } of lookups) {
      if (
        result &&
        'channel' in result &&
        'guild_id' in result.channel &&
        result.channel.guild_id === guildId
      ) {
        byId.set(channelId, result.channel);
      } else {
        info.set(channelId, {
          name: null,
          parentName: null,
          status: !result
            ? ChannelStatus.UNKNOWN
            : 'missing' in result && result.missing === 'noAccess'
              ? ChannelStatus.NO_ACCESS
              : ChannelStatus.DELETED,
        });
      }
    }
    for (const id of ids) {
      const channel = byId.get(id);
      if (!channel) continue;
      const meta = 'thread_metadata' in channel ? channel.thread_metadata : undefined;
      const parentId = parentOf(channel);
      info.set(id, {
        name: channel.name ?? null,
        parentName: meta && parentId ? (byId.get(parentId)?.name ?? null) : null,
        status: meta?.locked
          ? ChannelStatus.LOCKED
          : meta?.archived
            ? ChannelStatus.ARCHIVED
            : ChannelStatus.OK,
      });
    }
    return info;
  }

  /** One channel by ID, cached a few minutes; null when Discord didn't answer. */
  private async lookUpChannel(channelId: string, token: string | null) {
    const key = `discord:channel:${channelId}`;
    const cached = await this.cache.get<ChannelLookup>(key);
    if (cached) return cached;
    try {
      const result = await this.discordOauthService.findChannel({ channelId, token });
      await this.cache.set(key, result, CHANNEL_LOOKUP_TTL);
      return result;
    } catch {
      return null;
    }
  }

  async channelNames(guildId: string, applicationId: string | null, channelIds: string[]) {
    const info = await this.channelInfo(guildId, applicationId, channelIds);
    return new Map(
      [...info].flatMap(([id, channel]) => (channel.name ? [[id, channel.name] as const] : [])),
    );
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
