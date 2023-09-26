import { Collections, RedisKeyPrefixes, Tokens } from '@app/constants';
import {
  CapitalRaidRemindersEntity,
  CapitalRaidSchedulesEntity,
  CapitalRaidSeasonsEntity,
} from '@app/entities';
import { formatDate } from '@app/helper';
import { MongodbService, TrackActivityInput } from '@app/mongodb';
import {
  PartialCapitalRaidSeason,
  RedisClient,
  RedisJSON,
  RedisService,
  TrackedClanList,
  getRedisKey,
} from '@app/redis';
import RestHandler from '@app/rest/rest.module';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  APICapitalRaidSeason,
  APIClan,
  calculateOffensiveRaidMedals,
  calculateRaidsCompleted,
} from 'clashofclans.js';
import moment from 'moment';
import { Collection, Db } from 'mongodb';

@Injectable()
export class CapitalService {
  constructor(
    @Inject(Tokens.MONGODB) private db: Db,
    @Inject(Tokens.REDIS) private redis: RedisClient,
    @Inject(Tokens.REST) private restClient: RestHandler,
    private redisService: RedisService,
    private mongoService: MongodbService,

    @Inject(Collections.CAPITAL_RAID_SEASONS)
    private raidSeasonsCollection: Collection<CapitalRaidSeasonsEntity>,
    @Inject(Collections.RAID_REMINDERS)
    private raidRemindersCollection: Collection<CapitalRaidRemindersEntity>,
    @Inject(Collections.RAID_SCHEDULERS)
    private raidSchedulesCollection: Collection<CapitalRaidSchedulesEntity>,
  ) {}

  private logger = new Logger(CapitalService.name);
  private cached = new Map<string, TrackedClanList>();
  private pollingInterval = 1 * 60 * 1000; // 1 minute

  private async onModuleInit() {
    this.logger.debug('Loading clans...');
    await this.loadClans();

    this.logger.debug('Start polling...');
    await this.startPolling();
  }

  private async fetchCapitalRaidWeekend(clanTag: string) {
    const clan = await this.redisService.getClan(clanTag);
    if (!clan) return null;

    const { body, res } = await this.restClient.getCapitalRaidSeasons(clanTag, { limit: 1 });
    if (!res.ok || !body.items.length) return null;

    const season = body.items.at(0)!;
    if (!Array.isArray(season.members)) return null;

    const { weekId } = this.getRaidWeekendTiming();
    const raidWeekId = this.parseRaidWeekendId(season.startTime);

    const cached = await this.redisService.getCapitalRaidSeason(clanTag);

    await this.createReminders({ clan, season, weekId, raidWeekId });
    await this.updateCollection({ season, clan, raidWeekId, weekId, cached });
    await this.trackActivity({ cached, clan, season, raidWeekId });
    await this.updateCache({ clan, season, raidWeekId });

    return season;
  }

  private async updateCache({
    clan,
    season,
    raidWeekId,
  }: {
    clan: APIClan;
    season: APICapitalRaidSeason;
    raidWeekId: string;
  }) {
    const multi = this.redis.multi();

    for (const member of season.members!) {
      multi.json.set(getRedisKey(RedisKeyPrefixes.CAPITAL_RAID_MEMBER, member.tag), '$', {
        name: member.name,
        tag: member.tag,
        weekId: raidWeekId,
        clan: { tag: clan.tag, name: clan.name },
      });
      multi.expire(
        getRedisKey(RedisKeyPrefixes.CAPITAL_RAID_MEMBER, member.tag),
        60 * 60 * 24 * 10,
      );
    }

    const payload = {
      name: clan.name,
      tag: clan.tag,
      state: season.state,
      defensiveReward: season.defensiveReward,
      capitalTotalLoot: season.capitalTotalLoot,
      totalAttacks: season.totalAttacks,
      clanCapitalPoints: clan.clanCapitalPoints,
      enemyDistrictsDestroyed: season.enemyDistrictsDestroyed,
      weekId: raidWeekId,
      members: season.members!,
    } satisfies PartialCapitalRaidSeason;

    multi.json.set(
      getRedisKey(RedisKeyPrefixes.CAPITAL_RAID_SEASON, clan.tag),
      '$',
      payload as unknown as RedisJSON,
    );
    multi.expire(getRedisKey(RedisKeyPrefixes.CAPITAL_RAID_SEASON, clan.tag), 60 * 60 * 24 * 10);
    return multi.exec();
  }

  private async trackActivity({
    cached,
    clan,
    season,
    raidWeekId,
  }: {
    cached: PartialCapitalRaidSeason | null;
    clan: APIClan;
    season: APICapitalRaidSeason;
    raidWeekId: string;
  }) {
    if (cached && cached.weekId === raidWeekId) {
      const players: TrackActivityInput[] = [];
      for (const member of season.members!) {
        const oldMember = cached.members.find((mem) => mem.tag === member.tag);
        if (oldMember?.attacks === member.attacks) continue;
        players.push({
          name: member.name,
          tag: member.tag,
          clan: { name: clan.name, tag: clan.tag },
        });
      }

      if (players.length) {
        await this.mongoService.trackActivity(players);
      }
    }
  }

  private async updateCollection({
    season,
    raidWeekId,
    weekId,
    cached,
    clan,
  }: {
    season: APICapitalRaidSeason;
    raidWeekId: string;
    weekId: string;
    cached: PartialCapitalRaidSeason | null;
    clan: APIClan;
  }) {
    if (
      raidWeekId === weekId &&
      cached &&
      (cached.capitalTotalLoot !== season.capitalTotalLoot ||
        cached.state !== season.state ||
        cached.members.length !== season.members!.length ||
        cached.defensiveReward !== season.defensiveReward ||
        cached.clanCapitalPoints !== clan.clanCapitalPoints)
    ) {
      await this.raidSeasonsCollection.updateOne(
        { weekId, tag: clan.tag },
        {
          $setOnInsert: {
            name: clan.name,
            tag: clan.tag,
            weekId,
            clanCapitalPoints: clan.clanCapitalPoints,
            capitalLeague: clan.capitalLeague,
            badgeURL: clan.badgeUrls.large,
            startDate: formatDate(season.startTime),
            createdAt: new Date(),
          },
          $set: {
            state: season.state,
            members: season.members ?? [],
            endDate: formatDate(season.endTime),
            offensiveReward:
              season.offensiveReward ||
              calculateOffensiveRaidMedals(season.attackLog, season.offensiveReward),
            defensiveReward: season.defensiveReward,
            capitalTotalLoot: season.capitalTotalLoot,
            totalAttacks: season.totalAttacks,
            enemyDistrictsDestroyed: season.enemyDistrictsDestroyed,
            raidsCompleted: calculateRaidsCompleted(season.attackLog),
            _clanCapitalPoints: clan.clanCapitalPoints,
            _capitalLeague: clan.capitalLeague,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    }
  }

  private async createReminders({
    clan,
    season,
    weekId,
    raidWeekId,
  }: {
    clan: APIClan;
    season: APICapitalRaidSeason;
    weekId: string;
    raidWeekId: string;
  }) {
    const exists = await this.redis.get(
      getRedisKey(RedisKeyPrefixes.CAPITAL_REMINDER_CURSOR, `${weekId}-${clan.tag}`),
    );
    if (exists) return null;
    if (raidWeekId !== weekId) return null;

    const reminders = await this.raidRemindersCollection.find({ clans: clan.tag }).toArray();

    const newRems: CapitalRaidSchedulesEntity[] = [];
    for (const reminder of reminders) {
      const timestamp = new Date(formatDate(season.endTime).getTime() - reminder.duration);
      if (Date.now() > timestamp.getTime()) continue;

      const schedule: CapitalRaidSchedulesEntity = {
        guild: reminder.guild,
        name: clan.name,
        tag: clan.tag,
        duration: reminder.duration,
        reminderId: reminder._id,
        triggered: false,
        source: `service-capital-${process.pid}`,
        timestamp,
        createdAt: new Date(),
      };

      if (reminder.clans.includes(clan.tag)) {
        newRems.push({ ...schedule, name: clan.name, tag: clan.tag });
      }
    }

    if (newRems.length) {
      await this.raidSchedulesCollection.insertMany(newRems);
    }

    return this.redis.set(
      getRedisKey(RedisKeyPrefixes.CAPITAL_REMINDER_CURSOR, `${weekId}-${clan.tag}`),
      formatDate(season.endTime).toISOString(),
      {
        EX: 60 * 60 * 24 * 4.5,
      },
    );
  }

  private async loadClans() {
    const clans = await this.redisService.getTrackedClans();
    for (const clan of clans) this.cached.set(clan.tag, clan);
  }

  private async startPolling() {
    try {
      for (const clanTag of this.cached.keys()) {
        await this.fetchCapitalRaidWeekend(clanTag);
      }
    } finally {
      setTimeout(() => this.startPolling.bind(this), this.pollingInterval).unref();
    }
  }

  private getRaidWeekendTiming() {
    const start = moment();
    const day = start.day();
    const hours = start.hours();
    const isRaidWeekend =
      (day === 5 && hours >= 7) || [0, 6].includes(day) || (day === 1 && hours < 7);
    if (day < 5 || (day <= 5 && hours < 7)) start.day(-7);
    start.day(5);
    start.hours(7).minutes(0).seconds(0).milliseconds(0);
    return {
      startTime: start.toDate(),
      endTime: start.clone().add(3, 'days').toDate(),
      weekId: start.format('YYYY-MM-DD'),
      isRaidWeekend,
    };
  }

  private parseRaidWeekendId(startTime: string | Date) {
    return moment(startTime).format('YYYY-MM-DD');
  }

  public async getCapitalRaidWeekend(clanTag: string, weekId?: string) {
    if (!weekId) weekId = this.getRaidWeekendTiming().weekId;

    const season = await this.raidSeasonsCollection.findOne({ tag: clanTag, weekId });
    if (!season) throw new NotFoundException();

    return season;
  }
}
