import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Collection, Db, ObjectId } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import {
  CapitalRaidReminderInput,
  ClanGamesReminderInput,
  ClanWarReminderInput,
  DURATION_LIMITS,
  DURATION_STEP,
} from './dto';
import { GuildDiscordService, Webhook } from './guild-discord.service';
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
    private readonly discord: GuildDiscordService,
    private readonly schedules: ReminderSchedulesService,
  ) {}

  async create<K extends ReminderKind>(
    kind: K,
    input: { guildId: string; applicationId: string | null; body: ReminderInputs[K] },
  ) {
    const { guildId, body } = input;
    await this.validate(kind, guildId, body);
    await this.discord.checkChannel(guildId, input.applicationId, body.channelId);
    await this.checkLimit(kind, guildId);

    const { webhook: _, channelId, ...fields } = body;
    const reminder = {
      ...fields,
      _id: new ObjectId(),
      guild: guildId,
      channel: channelId,
      message: body.message.trim(),
      webhook: await this.discord.resolveWebhook(
        guildId,
        input.applicationId,
        channelId,
        body.webhook,
      ),
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
      await this.discord.checkChannel(guildId, input.applicationId, body.channelId);
    }

    const { webhook: _, channelId, ...fields } = body;
    const keepWebhook = existing.channel === channelId && !body.webhook;
    const webhook = keepWebhook
      ? (existing.webhook ?? null)
      : await this.discord.resolveWebhook(guildId, input.applicationId, channelId, body.webhook);

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

  // The three reminder collections share these fields; typing them as one keeps writes generic.
  private reminders(kind: ReminderKind) {
    return this.db.collection(REMINDER_COLLECTIONS[kind]) as unknown as Collection<ReminderRecord>;
  }
}
