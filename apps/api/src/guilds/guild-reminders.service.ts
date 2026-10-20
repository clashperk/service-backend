import { DiscordOauthService } from '@app/discord-oauth';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChannelType } from 'discord-api-types/v10';
import { Collection, Db, ObjectId } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import {
  CapitalRaidReminderInput,
  ClanGamesReminderInput,
  ClanWarReminderInput,
  DURATION_LIMITS,
  DURATION_STEP,
  GuildChannelDto,
  GuildRoleDto,
} from './dto';
import { ReminderSchedulesService } from './reminder-schedules.service';

export type ReminderKind = 'clanWars' | 'capitalRaids' | 'clanGames';

type ReminderInputs = {
  clanWars: ClanWarReminderInput;
  capitalRaids: CapitalRaidReminderInput;
  clanGames: ClanGamesReminderInput;
};

const REMINDER_COLLECTIONS = {
  clanWars: Collections.CLAN_WAR_REMINDERS,
  capitalRaids: Collections.CAPITAL_RAID_REMINDERS,
  clanGames: Collections.CLAN_GAMES_REMINDERS,
} as const;

const POSTABLE_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

type Webhook = { id: string; token: string };

type ReminderRecord = {
  _id: ObjectId;
  guild: string;
  channel: string;
  clans: string[];
  duration: number;
  webhook?: Webhook | null;
  threadId?: string;
};

@Injectable()
export class GuildRemindersService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discordOauthService: DiscordOauthService,
    private readonly schedules: ReminderSchedulesService,
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

  async create<K extends ReminderKind>(
    kind: K,
    input: { guildId: string; applicationId: string | null; body: ReminderInputs[K] },
  ) {
    const { guildId, body } = input;
    await this.validate(kind, guildId, body);
    await this.checkChannel(guildId, input.applicationId, body.channelId);
    await this.checkLimit(kind, guildId);

    const { webhook: _, channelId, ...fields } = body;
    const reminder = {
      ...fields,
      _id: new ObjectId(),
      guild: guildId,
      channel: channelId,
      message: body.message.trim(),
      webhook: await this.resolveWebhook(guildId, channelId, body.webhook),
      createdAt: new Date(),
    };
    await this.reminders(kind).insertOne(reminder);
    await this.schedules.reschedule(kind, reminder);
    return { id: reminder._id.toHexString() };
  }

  async update<K extends ReminderKind>(
    kind: K,
    input: {
      guildId: string;
      applicationId: string | null;
      reminderId: string;
      body: ReminderInputs[K];
    },
  ) {
    const { guildId, body } = input;
    const existing = await this.findOrThrow(kind, guildId, input.reminderId);
    await this.validate(kind, guildId, body);
    if (existing.channel !== body.channelId) {
      await this.checkChannel(guildId, input.applicationId, body.channelId);
    }

    const { webhook: _, channelId, ...fields } = body;
    const keepWebhook = existing.channel === channelId && !body.webhook;
    const webhook = keepWebhook
      ? (existing.webhook ?? null)
      : await this.resolveWebhook(guildId, channelId, body.webhook);

    const update = { ...fields, channel: channelId, message: body.message.trim(), webhook };
    // A thread belongs to the old channel, so moving the reminder drops it.
    await this.reminders(kind).updateOne(
      { _id: existing._id },
      existing.channel === channelId
        ? { $set: update }
        : { $set: update, $unset: { threadId: true } },
    );
    await this.schedules.reschedule(kind, { ...existing, ...update, guild: guildId });
    return { id: existing._id.toHexString() };
  }

  async delete(kind: ReminderKind, input: { guildId: string; reminderId: string }) {
    const existing = await this.findOrThrow(kind, input.guildId, input.reminderId);
    await this.reminders(kind).deleteOne({ _id: existing._id });
    await this.schedules.clear(kind, existing._id);
  }

  private async findOrThrow(kind: ReminderKind, guildId: string, reminderId: string) {
    if (!ObjectId.isValid(reminderId)) throw new NotFoundException('Reminder not found.');
    const reminder = await this.db
      .collection(REMINDER_COLLECTIONS[kind])
      .findOne({ _id: new ObjectId(reminderId), guild: guildId });
    if (!reminder) throw new NotFoundException('Reminder not found.');
    return reminder;
  }

  private async validate(
    kind: ReminderKind,
    guildId: string,
    body: { duration: number; clans: string[] },
  ) {
    if (body.duration > DURATION_LIMITS[kind] || body.duration % DURATION_STEP !== 0) {
      throw new BadRequestException(
        `Pick a time between 15 minutes and ${DURATION_LIMITS[kind] / 3_600_000} hours, in 15-minute steps.`,
      );
    }
    const known = await this.db
      .collection(Collections.CLAN_STORES)
      .countDocuments({ guild: guildId, tag: { $in: body.clans } });
    if (known !== body.clans.length) {
      throw new BadRequestException('Every clan must be added to this server.');
    }
  }

  /** The bot posts wherever the record says, so the channel must be one of this server's. */
  private async checkChannel(guildId: string, applicationId: string | null, channelId: string) {
    const channels = await this.listChannels({ guildId, applicationId });
    if (!channels.some((channel) => channel.id === channelId)) {
      throw new BadRequestException('Pick a text or announcement channel in this server.');
    }
  }

  /** The bot's cap: 5 per clan or 25, whichever is more; supporters have none. */
  private async checkLimit(kind: ReminderKind, guildId: string) {
    const [count, clans, patron] = await Promise.all([
      this.reminders(kind).countDocuments({ guild: guildId }),
      this.db.collection(Collections.CLAN_STORES).countDocuments({ guild: guildId }),
      this.db.collection(Collections.PATRONS).findOne({ 'active': true, 'guilds.id': guildId }),
    ]);
    const max = Math.max(clans * 5, 25);
    if (count >= max && !patron) {
      throw new ForbiddenException(`This server has reached its limit of ${max} reminders.`);
    }
  }

  /** A webhook from Discord's sign-in must belong to this channel; otherwise reuse one ClashPerk already has there. */
  private async resolveWebhook(
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
    // Without a webhook the bot creates one in the channel when the reminder first fires.
    return (await this.knownWebhooks(guildId)).get(channelId) ?? null;
  }

  /** Webhooks ClashPerk already posts through in this server, by channel. */
  private async knownWebhooks(guildId: string) {
    const [reminders, logs] = await Promise.all([
      Promise.all(
        (Object.keys(REMINDER_COLLECTIONS) as ReminderKind[]).map((kind) =>
          this.reminders(kind)
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

  // The three reminder collections share these fields; typing them as one keeps writes generic.
  private reminders(kind: ReminderKind) {
    return this.db.collection(REMINDER_COLLECTIONS[kind]) as unknown as Collection<ReminderRecord>;
  }

  private async botToken(applicationId: string | null) {
    if (!applicationId) return null;
    const bot = await this.db
      .collection(Collections.CUSTOM_BOTS)
      .findOne({ serviceId: applicationId });
    return bot?.token ?? null;
  }
}
