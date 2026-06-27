import { ClashClient, ClashClientService, Season } from '@app/clash-client';
import { Flags, RedisChannels, RedisKeys, UNRANKED_TIER, WorkerEvents } from '@app/constants';
import { formatDuration, Util } from '@app/helpers';
import { Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APICapitalRaidSeason, APIClan } from 'clashofclans.js';
import cluster from 'cluster';
import Redis from 'ioredis';
import moment from 'moment';
import { AnyBulkWriteOperation, Db, ObjectId } from 'mongodb';
import { Collections, MONGODB_TOKEN, REDIS_PUB_TOKEN, REDIS_TOKEN } from '../db';
import { RedisService } from '../db/redis.service';
import { BulkWriterService } from '../tasks/bulk-writer.service';
import { WorkerInitDto } from '../util/dto';
import { Emitter } from '../util/emitter';
import { WorkerService } from '../worker.service';

interface Cache {
  tag: string;
}

export interface RaidSchedule {
  guild: string;
  name: string;
  tag: string;
  duration: number;
  source?: string;
  reminderId: ObjectId;
  triggered: boolean;
  timestamp: Date;
  createdAt: Date;
}

export interface RaidReminder {
  _id: ObjectId;
  guild: string;
  channel: string;
  message: string;
  duration: number;
  clans: string[];
  createdAt: Date;
}

export class CapitalRaidService {
  private logger = new Logger(CapitalRaidService.name);
  private readonly cached: Map<string, Cache> = new Map();
  private refreshInterval = 2 * 60 * 1000;
  private clashClient: ClashClient;

  public constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(REDIS_PUB_TOKEN) private publisher: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    private workerService: WorkerService,
    private redisService: RedisService,
    private eventEmitter: Emitter,
    private bulkWriter: BulkWriterService,
    private clashClientService: ClashClientService,
  ) {
    this.clashClient = this.clashClientService.getClient();
  }

  public calcRaidCompleted(attackLog: APICapitalRaidSeason['attackLog']) {
    let total = 0;
    for (const clan of attackLog) {
      if (clan.districtsDestroyed === clan.districtCount) total += 1;
    }
    return total;
  }

  public calcRaidMedals(raidSeason: APICapitalRaidSeason) {
    const districtMap: Record<string, number> = {
      1: 135,
      2: 225,
      3: 350,
      4: 405,
      5: 460,
    };
    const capitalMap: Record<string, number> = {
      2: 180,
      3: 360,
      4: 585,
      5: 810,
      6: 1115,
      7: 1240,
      8: 1260,
      9: 1375,
      10: 1450,
    };

    let totalMedals = 0;
    let attacksDone = 0;
    for (const clan of raidSeason.attackLog) {
      attacksDone += clan.attackCount;
      for (const district of clan.districts) {
        if (district.destructionPercent === 100) {
          if (district.id === 70000000) {
            totalMedals += capitalMap[district.districtHallLevel];
          } else {
            totalMedals += districtMap[district.districtHallLevel];
          }
        }
      }
    }

    if (totalMedals !== 0) {
      totalMedals = Math.ceil(totalMedals / attacksDone);
    }
    return Math.max(totalMedals, raidSeason.offensiveReward);
  }

  public async exec(tag: string) {
    if (!this.cached.has(tag)) return null;

    const clan = await this.redisService.getClan(tag);
    if (!clan) return null;

    const season = await this.getRaidSeason(clan);
    if (!season) return null;
    if (!Array.isArray(season.members)) return null;

    const { weekId } = Util.raidWeek();
    const raidWeekId = this.getWeekId(season.startTime);

    const inserted = await this.redis.get(`RAID_WEEK:${weekId}-${clan.tag}`);
    if (!inserted && raidWeekId === weekId)
      await this.createReminders({ clan, raid: season, weekId });

    const cached = await this.redisService.getRaidSeason(clan.tag);

    if (
      raidWeekId === weekId &&
      cached &&
      (cached.capitalTotalLoot !== season.capitalTotalLoot ||
        cached.state !== season.state ||
        cached.members.length !== season.members.length ||
        cached.defensiveReward !== season.defensiveReward ||
        cached.clanCapitalPoints !== clan.clanCapitalPoints)
    ) {
      const collection = this.db.collection(Collections.CAPITAL_RAID_SEASONS);
      await collection.updateOne(
        { weekId, tag: clan.tag },
        {
          $setOnInsert: {
            name: clan.name,
            tag: clan.tag,
            weekId,
            clanCapitalPoints: clan.clanCapitalPoints,
            capitalLeague: clan.capitalLeague,
            badgeURL: clan.badgeUrls.large,
            startDate: moment(season.startTime).toDate(),
            createdAt: new Date(),
          },
          $set: {
            state: season.state,
            members: season.members,
            endDate: moment(season.endTime).toDate(),
            offensiveReward: season.offensiveReward || this.calcRaidMedals(season),
            defensiveReward: season.defensiveReward,
            capitalTotalLoot: season.capitalTotalLoot,
            totalAttacks: season.totalAttacks,
            enemyDistrictsDestroyed: season.enemyDistrictsDestroyed,
            raidsCompleted: this.calcRaidCompleted(season.attackLog),
            _clanCapitalPoints: clan.clanCapitalPoints,
            _capitalLeague: clan.capitalLeague,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    if (this.getWeekId(season.startTime) !== weekId) {
      await this.redis.del(`RAID_SEASON:${clan.tag}`);
    }

    try {
      await this.activity(clan, season as unknown as Required<APICapitalRaidSeason>);
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async activity(clan: APIClan, season: Required<APICapitalRaidSeason>) {
    const cached = await this.redisService.getRaidSeason(clan.tag);

    const members: any[] = [];
    if (cached && this.getWeekId(season.startTime) === cached.weekId) {
      const collection = this.db.collection(Collections.PLAYERS);
      const ops: AnyBulkWriteOperation<any>[] = [];
      const seasonId = Season.ID;
      for (const m of season.members) {
        const oldMember = cached.members.find((mem) => mem.tag === m.tag);
        if (oldMember?.attacks === m.attacks) continue;
        const clanMember = clan.memberList.find((mem) => mem.tag === m.tag);
        const $set = {
          name: m.name,
          clan: {
            tag: clan.tag,
            name: clan.name,
          },
          ...(clanMember && {
            trophies: clanMember.trophies,
            townHallLevel: clanMember.townHallLevel,
            leagueId: clanMember.leagueTier?.id || UNRANKED_TIER,
          }),
          lastSeen: new Date(),
        };

        ops.push({
          updateOne: {
            upsert: !!clanMember,
            filter: { tag: m.tag },
            update: { $set, $inc: { [`seasons.${seasonId}`]: 1 } },
          },
        });

        this.bulkWriter.activities.push({
          tag: m.tag,
          timestamp: Math.floor(Date.now() / 1000),
          clanTag: clan.tag,
          action: 'UNKNOWN',
        });

        members.push({
          name: m.name,
          tag: m.tag,
          looted: m.capitalResourcesLooted,
          attackLimit: m.attackLimit + m.bonusAttackLimit,
          attacks: m.attacks,
          townHallLevel: 0,
          op: 'CAPITAL_GOLD_RAID',
        });
      }
      if (ops.length) await collection.bulkWrite(ops, { ordered: false });
    }

    if (members.length) {
      this.eventEmitter.emit(WorkerEvents.CAPITAL_UPSTREAM, {
        tag: clan.tag,
        op: Flags.CAPITAL_LOG,
        members,
        clan: {
          name: clan.name,
          tag: clan.tag,
          badge: clan.badgeUrls.small,
          badgeUrl: clan.badgeUrls.small,
        },
      });
    }

    const multi = this.redis.multi();
    for (const member of season.members) {
      multi.set(
        `RAID_MEMBER:${member.tag}`,
        JSON.stringify({
          name: member.name,
          tag: member.tag,
          weekId: this.getWeekId(season.startTime),
          clan: { tag: clan.tag, name: clan.name },
        }),
        'EX',
        60 * 60 * 24 * 10,
      );
    }
    multi.set(
      `RAID_SEASON:${clan.tag}`,
      JSON.stringify({
        name: clan.name,
        tag: clan.tag,
        state: season.state,
        defensiveReward: season.defensiveReward,
        capitalTotalLoot: season.capitalTotalLoot,
        totalAttacks: season.totalAttacks,
        clanCapitalPoints: clan.clanCapitalPoints,
        enemyDistrictsDestroyed: season.enemyDistrictsDestroyed,
        weekId: this.getWeekId(season.startTime),
        members: season.members,
      }),
      'EX',
      60 * 60 * 24 * 10,
    );
    await multi.exec();
  }

  private toDate(ISO: string) {
    return new Date(moment(ISO).toDate());
  }

  private async createReminders({
    clan,
    raid,
    weekId,
  }: {
    clan: APIClan;
    raid: APICapitalRaidSeason;
    weekId: string;
  }) {
    await this.redis.set(
      `RAID_WEEK:${weekId}-${clan.tag}`,
      this.toDate(raid.endTime).toISOString(),
      'EX',
      60 * 60 * 24 * 4.5,
    );
    const reminders = await this.db
      .collection(Collections.RAID_REMINDERS)
      .find({ clans: clan.tag })
      .toArray();
    if (!reminders.length) return null;

    const newRems: any[] = [];
    const rand = Math.random();
    for (const reminder of reminders) {
      if (Date.now() > new Date(this.toDate(raid.endTime).getTime() - reminder.duration).getTime())
        continue;

      const schedule: RaidSchedule = {
        guild: reminder.guild,
        name: clan.name,
        tag: clan.tag,
        duration: reminder.duration,
        reminderId: reminder._id,
        triggered: false,
        source: `rpc_${cluster.worker?.id ?? 0}_${rand}`,
        timestamp: new Date(this.toDate(raid.endTime).getTime() - reminder.duration),
        createdAt: new Date(),
      };
      if (reminder.clans.includes(clan.tag)) {
        newRems.push({ ...schedule, name: clan.name, tag: clan.tag });
      }
    }

    if (!newRems.length) return null;
    return this.db.collection(Collections.RAID_SCHEDULERS).insertMany(newRems);
  }

  private getWeekId(weekId: string) {
    return moment(weekId).toDate().toISOString().substring(0, 10);
  }

  public async getRaidSeason(clan: APIClan): Promise<APICapitalRaidSeason | null> {
    const { body, res } = await this.clashClient.getCapitalRaidSeasons(clan.tag, { limit: 1 });
    if (!res.ok) return null;
    return body.items[0] ?? null;
  }

  private async enqueue(debug = true) {
    if ((process.env.DEBUG || debug) && !this.workerService.isInMaintenance) {
      this.logger.debug(`Starting Requests (${this.cached.size} Raids)`);
    }
    const startTime = Date.now();

    try {
      for (const tag of this.cached.keys()) {
        if (this.workerService.isInMaintenance) continue;
        await this.exec(tag);
      }

      if (!this.workerService.isInMaintenance) {
        await this.redis.hset(
          RedisKeys.LOOP_TIMINGS,
          RedisKeys.CAPITAL_RAID_LOOP,
          JSON.stringify({ timeTaken: Date.now() - startTime, timestamp: Date.now() }),
        );
      }
    } finally {
      const timeTaken = Date.now() - startTime;
      if ((process.env.DEBUG || debug) && !this.workerService.isInMaintenance) {
        this.logger.verbose(`Finished Requests [${formatDuration(timeTaken)}] (Raids)`);
      }

      setTimeout(
        this.enqueue.bind(this),
        (timeTaken >= this.refreshInterval ? 0 : this.refreshInterval - timeTaken) + 60000,
        false,
      );
    }
  }

  @OnEvent(WorkerEvents.CLANS_LOADED)
  public onWorkerInit(clans: WorkerInitDto[]) {
    if (process.env.CAPITAL_TRACKING !== '1') return;

    clans.forEach((data) => {
      const cache = this.cached.get(data.tag) ?? {};
      this.cached.set(data.tag, { ...cache, tag: data.tag });
    });

    return this.enqueue();
  }

  @OnEvent(WorkerEvents.CLAN_ADDED)
  public async add(data: { tag: string }) {
    if (process.env.CAPITAL_TRACKING !== '1') return;

    const existing = this.cached.has(data.tag);
    this.cached.set(data.tag, { tag: data.tag });
    if (!existing) return this.exec(data.tag);
  }

  @OnEvent(WorkerEvents.CLAN_REMOVED)
  public delete(tag: string) {
    return this.cached.delete(tag);
  }

  @OnEvent(WorkerEvents.CAPITAL_UPSTREAM)
  async onUpstream(data: any) {
    await this.publisher.publish(RedisChannels.UPSTREAM_FEED, JSON.stringify(data));
  }
}
