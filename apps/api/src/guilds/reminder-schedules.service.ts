import { ClashClient } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import { APIClanWar } from 'clashofclans.js';
import moment from 'moment';
import { Db, ObjectId } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';

type ReminderKind = 'clanWars' | 'capitalRaids' | 'clanGames';

type ScheduledReminder = {
  _id: ObjectId;
  guild: string;
  clans: string[];
  duration: number;
};

export const SCHEDULE_COLLECTIONS = {
  clanWars: Collections.CLAN_WAR_SCHEDULES,
  capitalRaids: Collections.CAPITAL_RAID_SCHEDULES,
  clanGames: Collections.CLAN_GAMES_SCHEDULES,
} as const;

// Matches the bot's check: friendly wars use one of these preparation lengths.
const FRIENDLY_PREP_TIMES = [24, 20, 16, 12, 8, 6, 4, 2, 1, 0.5, 0.25, 1 / 12].map(
  (hours) => hours * 60 * 60 * 1000,
);

const toDate = (time: string) => moment(time).toDate();

/**
 * Schedules a reminder for what is already running, as the bot does after `/reminders create`.
 * The bot watches the schedule collections, so inserting a schedule is enough for it to fire.
 */
@Injectable()
export class ReminderSchedulesService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly clashClient: ClashClient,
  ) {}

  async reschedule(kind: ReminderKind, reminder: ScheduledReminder) {
    await this.clear(kind, reminder._id);
    const runs = await this.currentRuns(kind, reminder.clans);
    const schedules = runs
      .map((run) => ({ ...run, timestamp: new Date(run.endTime.getTime() - reminder.duration) }))
      .filter((run) => run.timestamp.getTime() > Date.now())
      .map(({ endTime: _, ...run }) => ({
        _id: new ObjectId(),
        guild: reminder.guild,
        duration: reminder.duration,
        reminderId: reminder._id,
        source: 'api',
        triggered: false,
        createdAt: new Date(),
        ...run,
      }));
    if (schedules.length)
      await this.db.collection(SCHEDULE_COLLECTIONS[kind]).insertMany(schedules);
  }

  clear(kind: ReminderKind, reminderId: ObjectId) {
    return this.db.collection(SCHEDULE_COLLECTIONS[kind]).deleteMany({ reminderId });
  }

  private async currentRuns(kind: ReminderKind, clanTags: string[]) {
    const runs = await Promise.all(
      clanTags.map((tag) => {
        if (kind === 'clanWars') return this.warRuns(tag);
        if (kind === 'capitalRaids') return this.raidRuns(tag);
        return this.clanGamesRuns(tag);
      }),
    );
    return runs.flat();
  }

  private async warRuns(tag: string) {
    const [regular, cwl] = await Promise.all([this.regularWar(tag), this.cwlWars(tag)]);
    return [...regular, ...cwl]
      .filter(({ war }) => war.state === 'preparation' || war.state === 'inWar')
      .map(({ war, warTag }) => ({
        key: this.warKey(war),
        tag: war.clan.tag,
        name: war.clan.name,
        warTag,
        isFriendly: warTag ? false : this.isFriendly(war),
        endTime: toDate(war.endTime),
      }));
  }

  private async regularWar(tag: string) {
    const { body, res } = await this.clashClient.getCurrentWar(tag);
    return res.ok ? [{ war: body, warTag: null as string | null }] : [];
  }

  /** The last two rounds with war tags, like the bot: the one in war and the one preparing. */
  private async cwlWars(tag: string) {
    const { body: group, res } = await this.clashClient.getClanWarLeagueGroup(tag);
    if (!res.ok || group.state === 'notInWar') return [];

    const rounds = group.rounds.filter((round) => !round.warTags.includes('#0')).slice(-2);
    const wars: { war: APIClanWar; warTag: string | null }[] = [];
    for (const { warTags } of rounds) {
      const results = await Promise.all(
        warTags.map((warTag) => this.clashClient.getClanWarLeagueRound(warTag)),
      );
      const index = results.findIndex(
        ({ res, body }) => res.ok && (body.clan.tag === tag || body.opponent.tag === tag),
      );
      if (index < 0) continue;
      const war = results[index].body;
      const ours = war.clan.tag === tag;
      wars.push({
        war: {
          ...war,
          clan: ours ? war.clan : war.opponent,
          opponent: ours ? war.opponent : war.clan,
        },
        warTag: warTags[index],
      });
    }
    return wars;
  }

  private async raidRuns(tag: string) {
    const [{ body: seasons, res }, { body: clan, res: clanRes }] = await Promise.all([
      this.clashClient.getCapitalRaidSeasons(tag, { limit: 1 }),
      this.clashClient.getClan(tag),
    ]);
    const season = res.ok ? seasons.items[0] : undefined;
    if (!season?.members || !clanRes.ok) return [];
    return [{ tag: clan.tag, name: clan.name, endTime: toDate(season.endTime) }];
  }

  private async clanGamesRuns(tag: string) {
    const { startTime, endTime } = clanGamesWindow();
    if (Date.now() < startTime.getTime() || Date.now() > endTime.getTime()) return [];
    const { body: clan, res } = await this.clashClient.getClan(tag);
    return res.ok ? [{ tag: clan.tag, name: clan.name, endTime }] : [];
  }

  private isFriendly(war: APIClanWar) {
    const prep = toDate(war.startTime).getTime() - toDate(war.preparationStartTime).getTime();
    return FRIENDLY_PREP_TIMES.includes(prep);
  }

  private warKey(war: APIClanWar) {
    const date = moment(war.preparationStartTime).toISOString().slice(0, 16);
    const tags = [war.clan.tag, war.opponent.tag].sort((a, b) => a.localeCompare(b));
    return `${date}-${tags.join('-')}`;
  }
}

/** Clan Games run from the 22nd 08:00 UTC for six days, as the bot assumes. */
export function clanGamesWindow(now = new Date()) {
  const startTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 22, 8));
  const endTime = new Date(startTime.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { startTime, endTime };
}
