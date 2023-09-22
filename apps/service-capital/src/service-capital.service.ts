import { Collections, RedisKeyPrefixes, Tokens } from '@app/constants';
import { CapitalRaidSeasonsEntity } from '@app/entities/capital.entity';
import { MongodbService } from '@app/mongodb';
import { RedisClient, RedisService, TrackedClanList, getRedisKey } from '@app/redis';
import RestHandler from '@app/rest/rest.module';
import { Inject, Injectable } from '@nestjs/common';
import moment from 'moment';
import { Collection, Db } from 'mongodb';

@Injectable()
export class CapitalService {
  constructor(
    @Inject(Tokens.MONGODB) private readonly db: Db,
    @Inject(Tokens.REDIS) private readonly redis: RedisClient,
    @Inject(Tokens.REST) private readonly restClient: RestHandler,
    private readonly redisService: RedisService,
    private readonly mongoService: MongodbService,
    @Inject(Collections.CAPITAL_RAID_SEASONS)
    private readonly capitalRaidsCollection: Collection<CapitalRaidSeasonsEntity>,
  ) {}

  private readonly cached = new Map<string, TrackedClanList>();

  async onModuleInit() {
    await this.loadClans();
  }

  async fetchCapitalRaidWeekend(clanTag: string) {
    const clan = await this.redisService.getClan(clanTag);
    if (!clan) return null;

    const { body, res } = await this.restClient.getCapitalRaidSeasons(clanTag, { limit: 1 });
    if (!res.ok || !body.items.length) return null;

    const season = body.items.at(0)!;
    if (!Array.isArray(season.members)) return null;

    const { weekId } = this.getCapitalRaidWeekendTiming();
    const raidWeekId = this.getCurrentWeekId(season.startTime);

    const isCached = await this.redis.get(
      getRedisKey(RedisKeyPrefixes.CAPITAL_RAID_WEEK, `${weekId}-${clan.tag}`),
    );
    if (!isCached && raidWeekId === weekId) {
      // TODO: push reminders
    }
  }

  async loadClans() {
    const clans = await this.redisService.getTrackedClans();
    for (const clan of clans) this.cached.set(clan.tag, clan);
  }

  async startPolling() {
    for (const clanTag of this.cached.keys()) {
      await this.fetchCapitalRaidWeekend(clanTag);
    }
  }

  public getCapitalRaidWeekendTiming() {
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

  private getCurrentWeekId(weekId: string) {
    return moment(weekId).toDate().toISOString().substring(0, 10);
  }

  getHello(): string {
    return 'Hello World!';
  }
}
