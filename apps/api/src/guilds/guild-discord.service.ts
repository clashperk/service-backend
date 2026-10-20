import { DiscordOauthService } from '@app/discord-oauth';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { APIChannel, ChannelType } from 'discord-api-types/v10';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { GuildChannelDto, GuildRoleDto } from './dto';

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

const parentOf = (channel: APIChannel) =>
  'parent_id' in channel ? (channel.parent_id ?? null) : null;

/** The server's channels, roles and ClashPerk webhooks, shared by reminders and clan logs. */
@Injectable()
export class GuildDiscordService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discordOauthService: DiscordOauthService,
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

  /** Names for saved channels; archived threads aren't listed, so they're looked up one by one. */
  async channelNames(guildId: string, applicationId: string | null, channelIds: string[]) {
    const names = new Map<string, string>();
    try {
      const channels = await this.listChannels({ guildId, applicationId });
      for (const channel of channels) names.set(channel.id, channel.name);
      const token = await this.botToken(applicationId);
      const missing = [...new Set(channelIds)].filter((id) => !names.has(id));
      const found = await Promise.all(
        missing.map((channelId) => this.discordOauthService.getChannel({ channelId, token })),
      );
      for (const channel of found) {
        if (channel && 'guild_id' in channel && channel.guild_id === guildId && channel.name) {
          names.set(channel.id, channel.name);
        }
      }
    } catch {
      // Names are cosmetic, so a bot without access to the server just yields none.
    }
    return names;
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
