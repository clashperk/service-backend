import { DiscordOauthService } from '@app/discord-oauth';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ChannelType } from 'discord-api-types/v10';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { GuildChannelDto, GuildRoleDto } from './dto';

const POSTABLE_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

const REMINDER_COLLECTIONS = [
  Collections.CLAN_WAR_REMINDERS,
  Collections.CAPITAL_RAID_REMINDERS,
  Collections.CLAN_GAMES_REMINDERS,
] as const;

export type Webhook = { id: string; token: string };

/** The server's channels, roles and ClashPerk webhooks, shared by reminders and clan logs. */
@Injectable()
export class GuildDiscordService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discordOauthService: DiscordOauthService,
  ) {}

  async listChannels(input: {
    guildId: string;
    applicationId: string | null;
  }): Promise<GuildChannelDto[]> {
    const [channels, webhooks] = await Promise.all([
      this.discordOauthService.listChannels({
        guildId: input.guildId,
        token: await this.botToken(input.applicationId),
      }),
      this.knownWebhooks(input.guildId),
    ]);
    return channels
      .filter((channel) => POSTABLE_CHANNELS.includes(channel.type))
      .map((channel) => ({
        id: channel.id,
        name: channel.name ?? channel.id,
        type: channel.type,
        parentId: 'parent_id' in channel ? (channel.parent_id ?? null) : null,
        position: 'position' in channel ? channel.position : 0,
        hasWebhook: webhooks.has(channel.id),
      }))
      .sort((a, b) => a.position - b.position);
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

  /** The bot posts wherever the record says, so the channel must be one of this server's. */
  async checkChannel(guildId: string, applicationId: string | null, channelId: string) {
    const channels = await this.listChannels({ guildId, applicationId });
    if (!channels.some((channel) => channel.id === channelId)) {
      throw new BadRequestException('Pick a text or announcement channel in this server.');
    }
  }

  async checkRole(guildId: string, applicationId: string | null, roleId: string) {
    const roles = await this.listRoles({ guildId, applicationId });
    if (!roles.some((role) => role.id === roleId)) {
      throw new BadRequestException('Pick a role in this server.');
    }
  }

  /** A webhook from Discord's sign-in must belong to this channel; otherwise reuse one ClashPerk already has there. */
  async resolveWebhook(
    guildId: string,
    channelId: string,
    provided: Webhook | undefined,
  ): Promise<Webhook | null> {
    if (provided) {
      const webhook = await this.discordOauthService.getWebhook(provided);
      if (!webhook || webhook.guild_id !== guildId || webhook.channel_id !== channelId) {
        throw new BadRequestException("That webhook isn't in the chosen channel.");
      }
      return { id: provided.id, token: provided.token };
    }
    // Without a webhook the bot creates one in the channel the first time it posts.
    return (await this.knownWebhooks(guildId)).get(channelId) ?? null;
  }

  /** Webhooks ClashPerk already posts through in this server, by channel. */
  async knownWebhooks(guildId: string) {
    const [reminders, logs] = await Promise.all([
      Promise.all(
        REMINDER_COLLECTIONS.map((collection) =>
          this.db
            .collection(collection)
            .find(
              { guild: guildId, webhook: { $ne: null }, threadId: { $exists: false } },
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
    const byChannel = new Map<string, Webhook>();
    for (const { channel, webhook } of reminders.flat()) {
      if (webhook) byChannel.set(channel, { id: webhook.id, token: webhook.token });
    }
    for (const { channelId, webhook } of logs) {
      if (webhook) byChannel.set(channelId, { id: webhook.id, token: webhook.token });
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
