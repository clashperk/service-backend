import { DiscordRestService } from '@app/discord-rest';
import { Inject, Injectable } from '@nestjs/common';
import { AnyBulkWriteOperation, Db, ObjectId } from 'mongodb';
import { ClanCategoriesEntity, ClanStoresEntity, Collections, MONGODB_TOKEN } from '../db';
import {
  GuildClanDto,
  GuildRemindersDto,
  ReminderBaseDto,
  ReminderScheduleDto,
  ReorderClanCategoriesInput,
} from './dto';
import { GuildDiscordService } from './guild-discord.service';

// Only war schedules carry `isFriendly`; raid and clan games schedules have no war type.
const toWarType = (schedule: { warTag?: string | null; isFriendly?: boolean }) => {
  if (schedule.warTag) return 'cwl' as const;
  if (schedule.isFriendly === undefined) return null;
  return schedule.isFriendly ? ('friendly' as const) : ('normal' as const);
};

type ReminderEntityBase = {
  _id: ObjectId;
  channel: string;
  threadId?: string;
  message: string;
  duration: number;
  roles: string[];
  linkedOnly?: boolean;
  clans: string[];
  createdAt: Date;
};

const uncategorizedId = 'uncategorized';

@Injectable()
export class GuildsService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discordRest: DiscordRestService,
    private readonly guildDiscordService: GuildDiscordService,
  ) {}

  async listMembers(input: { guildId: string; query: string; applicationId: string | null }) {
    const bot = input.applicationId
      ? await this.bots.findOne({ serviceId: input.applicationId })
      : null;

    const members = await this.discordRest.listMembers({
      guildId: input.guildId,
      query: input.query,
      token: bot ? bot.token : null,
    });

    return members.map((member) => ({
      id: member.user.id,
      username: member.user.username,
      displayName: member.user.global_name || member.user.username,
      avatarUrl: this.discordRest.toAvatarUrl(member.user.id, member.user.avatar),
    }));
  }

  async getGuildClans(guildId: string) {
    const [clans, categories] = await Promise.all([
      this.clans
        .find(
          { guild: guildId },
          {
            projection: {
              name: 1,
              tag: 1,
              order: 1,
              categoryId: 1,
              alias: 1,
              nickname: 1,
              channels: 1,
            },
            sort: { order: 1 },
          },
        )
        .toArray(),
      this.categories
        .find({ guildId }, { projection: { displayName: 1, order: 1 }, sort: { order: 1 } })
        .toArray(),
    ]);

    const categoryMap = new Map(
      categories.map((category) => [
        category._id.toHexString(),
        { ...category, clans: [] as GuildClanDto[] },
      ]),
    );
    const uncategorized = {
      _id: uncategorizedId,
      order: -1,
      displayName: 'Uncategorized',
      clans: [] as GuildClanDto[],
    };

    const mappedClans = clans.map((clan) => {
      return {
        ...clan,
        league: 'Unknown',
        level: 10,
        members: 50,
        categoryId: clan.categoryId?.toHexString() || uncategorizedId,
        alias: clan.alias ?? null,
        nickname: clan.nickname ?? null,
        channels: clan.channels ?? [],
      };
    });

    for (const clan of mappedClans) {
      const category = clan.categoryId ? categoryMap.get(clan.categoryId) : uncategorized;
      if (category) {
        category.clans.push(clan);
      } else {
        uncategorized.clans.push(clan);
      }
    }

    return {
      guildId,
      name: 'Unknown',
      categories: [uncategorized, ...categoryMap.values()],
    };
  }

  async reorderGuildClans({
    categories,
    guildId,
  }: ReorderClanCategoriesInput & { guildId: string }) {
    const clanOps: AnyBulkWriteOperation<ClanStoresEntity>[] = [];
    const categoryOps: AnyBulkWriteOperation<ClanCategoriesEntity>[] = [];

    const clans = categories
      .flatMap((cg) => cg.clans.map((clan) => ({ ...clan, categoryId: cg._id })))
      .sort((a, b) => {
        if (a.categoryId === uncategorizedId && b.categoryId !== uncategorizedId) {
          return -1;
        }

        if (a.categoryId !== uncategorizedId && b.categoryId === uncategorizedId) {
          return 1;
        }

        return 0;
      });

    clans.forEach((clan, order) => {
      clanOps.push({
        updateOne: {
          filter: { _id: new ObjectId(clan._id), guild: guildId },
          update: {
            $set: {
              order,
              categoryId: ObjectId.isValid(clan.categoryId) ? new ObjectId(clan.categoryId) : null,
            },
          },
        },
      });
    });

    categories.forEach((cat, order) => {
      if (ObjectId.isValid(cat._id)) {
        categoryOps.push({
          updateOne: {
            filter: { _id: new ObjectId(cat._id), guildId },
            update: { $set: { order } },
          },
        });
      }
    });

    await this.categories.bulkWrite(categoryOps);
    await this.clans.bulkWrite(clanOps);
    await this.settings.updateOne({ guildId }, { $set: { clansSortingKey: 'order' } });

    return this.getGuildClans(guildId);
  }

  async getGuildReminders(input: {
    guildId: string;
    applicationId: string | null;
  }): Promise<GuildRemindersDto> {
    const { guildId } = input;
    const [clanWars, capitalRaids, clanGames, warSchedules, raidSchedules, gamesSchedules, clans] =
      await Promise.all([
        this.db.collection(Collections.CLAN_WAR_REMINDERS).find({ guild: guildId }).toArray(),
        this.db.collection(Collections.CAPITAL_RAID_REMINDERS).find({ guild: guildId }).toArray(),
        this.db.collection(Collections.CLAN_GAMES_REMINDERS).find({ guild: guildId }).toArray(),
        this.getSchedules(Collections.CLAN_WAR_SCHEDULES, guildId),
        this.getSchedules(Collections.CAPITAL_RAID_SCHEDULES, guildId),
        this.getSchedules(Collections.CLAN_GAMES_SCHEDULES, guildId),
        this.clans.find({ guild: guildId }, { projection: { name: 1, tag: 1 } }).toArray(),
      ]);
    const channels = await this.guildDiscordService.channelStatuses(
      guildId,
      input.applicationId,
      [...clanWars, ...capitalRaids, ...clanGames].map((reminder) => reminder.channel),
    );

    const clanNames = new Map(clans.map((clan) => [clan.tag, clan.name]));
    const schedulesByReminder = new Map<string, ReminderScheduleDto[]>();
    for (const schedule of [...warSchedules, ...raidSchedules, ...gamesSchedules]) {
      const key = schedule.reminderId.toHexString();
      const list = schedulesByReminder.get(key) ?? [];
      list.push({
        id: schedule._id.toHexString(),
        clan: { tag: schedule.tag, name: clanNames.get(schedule.tag) ?? schedule.name },
        timestamp: schedule.timestamp,
        triggered: schedule.triggered,
        reason: schedule.reason ?? null,
        warType: toWarType(schedule),
      });
      schedulesByReminder.set(key, list);
    }

    // Picks fields explicitly so the webhook token never leaves the API.
    const toBase = (reminder: ReminderEntityBase): ReminderBaseDto => ({
      id: reminder._id.toHexString(),
      shortId: reminder._id.toHexString().slice(-5).toUpperCase(),
      channelId: reminder.channel,
      channelName: channels.get(reminder.channel)?.name ?? null,
      threadId: reminder.threadId ?? null,
      message: reminder.message,
      duration: reminder.duration,
      roles: reminder.roles,
      linkedOnly: reminder.linkedOnly ?? false,
      clans: reminder.clans.map((tag) => ({ tag, name: clanNames.get(tag) ?? tag })),
      schedules: schedulesByReminder.get(reminder._id.toHexString()) ?? [],
      createdAt: reminder.createdAt,
    });

    return {
      clanWars: clanWars.map((reminder) => ({
        ...toBase(reminder),
        disabled: reminder.disabled,
        townHalls: reminder.townHalls,
        remaining: reminder.remaining,
        warTypes: reminder.warTypes,
        smartSkip: reminder.smartSkip,
        silent: reminder.silent,
        randomLimit: reminder.randomLimit ?? null,
      })),
      capitalRaids: capitalRaids.map((reminder) => ({
        ...toBase(reminder),
        allMembers: reminder.allMembers,
        minThreshold: reminder.minThreshold,
        remaining: reminder.remaining,
      })),
      clanGames: clanGames.map((reminder) => ({
        ...toBase(reminder),
        allMembers: reminder.allMembers,
        minPoints: reminder.minPoints,
      })),
    };
  }

  private getSchedules(
    collection:
      | Collections.CLAN_WAR_SCHEDULES
      | Collections.CAPITAL_RAID_SCHEDULES
      | Collections.CLAN_GAMES_SCHEDULES,
    guildId: string,
  ) {
    return this.db
      .collection(collection)
      .find(
        { guild: guildId },
        {
          projection: {
            reminderId: 1,
            tag: 1,
            name: 1,
            timestamp: 1,
            triggered: 1,
            reason: 1,
            isFriendly: 1,
            warTag: 1,
          },
          sort: { timestamp: 1 },
        },
      )
      .toArray();
  }

  private get clans() {
    return this.db.collection(Collections.CLAN_STORES);
  }

  private get categories() {
    return this.db.collection(Collections.CLAN_CATEGORIES);
  }

  private get settings() {
    return this.db.collection(Collections.SETTINGS);
  }

  private get bots() {
    return this.db.collection(Collections.CUSTOM_BOTS);
  }
}
