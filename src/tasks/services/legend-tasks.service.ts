import { ClashClient, Season } from '@app/clash-client';
import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import moment from 'moment';
import { CLICKHOUSE_TOKEN, REDIS_TOKEN } from '../../db';
import { LegendRankingThresholdsSnapShotDto, ThresholdsDto } from '../dto';

const SNAPSHOT_TTL = 60 * 60 * 24 + 60 * 5; // 1 day + 5 minutes
const HISTORICAL_SNAPSHOT_TTL = 45 * 60 * 60 * 24 + 60 * 5; // 45 days + 5 minutes
const CACHED_RANKS_TTL = 60 * 10; // 10 minutes

const POSSIBLE_RANKS = [1, 3, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
const MAX_LIMIT = 50000;

@Injectable()
export class LegendTasksService {
  private logger = new Logger(LegendTasksService.name);
  constructor(
    private clashClient: ClashClient,
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(CLICKHOUSE_TOKEN) private clickhouseClient: ClickHouseClient,
  ) {}

  public async takeSnapshot() {
    this.logger.log('Taking legend ranks snapshot...');
    const thresholds = await this.getRanksThresholds({ useCache: false });

    const timestamp = new Date().toISOString();
    const snapshotKey = 'RAW:LEGEND-RANKS';
    const historyKey = `${snapshotKey}:${timestamp.slice(0, 10)}`;
    const payload = JSON.stringify({ timestamp, thresholds });

    await this.redis
      .multi()
      .set(snapshotKey, payload, 'EX', SNAPSHOT_TTL)
      .set(historyKey, payload, 'EX', HISTORICAL_SNAPSHOT_TTL)
      .exec();

    this.logger.log(`Took legend ranks snapshot for ${timestamp}`);
    return { message: 'Ok' };
  }

  public async getRanksThresholds({ useCache = true }: { useCache?: boolean }) {
    const key = 'CACHED:LEGEND-RANKS';
    const cached = await this.redisJSON<ThresholdsDto[]>(key);
    if (cached && useCache) return cached;

    const result = await this.aggregateRanksThresholds();
    await this.redis.set(key, JSON.stringify(result), 'EX', CACHED_RANKS_TTL);

    return result;
  }

  public async getEoDThresholds() {
    const key = 'RAW:LEGEND-RANKS';
    const result = await this.redisJSON<LegendRankingThresholdsSnapShotDto>(key);
    if (!result) return null;

    return result;
  }

  public async getHistoricalRanksThresholds() {
    const { endTime, startTime } = Season.getSeason();
    const timestamps = Array.from({ length: moment(endTime).diff(startTime, 'days') + 1 }, (_, i) =>
      moment(startTime).add(i, 'days'),
    ).filter((mts) => mts.isSameOrBefore(moment()));

    const thresholdRecords = await this.redis.mget(
      timestamps.map((mts) => `RAW:LEGEND-RANKS:${mts.format('YYYY-MM-DD')}`),
    );

    const thresholds = thresholdRecords
      .filter((result) => result !== null)
      .map((result, idx) =>
        result
          ? (JSON.parse(result) as LegendRankingThresholdsSnapShotDto)
          : { timestamp: timestamps[idx].toISOString(), thresholds: [] as ThresholdsDto[] },
      );

    return thresholds;
  }

  private async aggregateRanksThresholds() {
    const ranks = POSSIBLE_RANKS.filter((rank) => rank <= MAX_LIMIT);

    const seasonId = this.clashClient.util.getSeasonId();
    const where =
      new Date() > new Date('2025-10-06T05:00:00.000Z') &&
      new Date() <= new Date('2025-10-27T05:00:00.000Z')
        ? `createdAt >= {startTime: DateTime}`
        : `seasonId = {seasonId: String}`;

    const rows = await this.clickhouseClient
      .query({
        query: `
          WITH ranking_query AS (
            SELECT
              trophies,
              streak,
              seasonId,
              row_number() OVER (PARTITION BY seasonId ORDER BY trophies DESC) AS rank
            FROM legend_players
            FINAL
            WHERE ${where}
          )
          SELECT *
          FROM ranking_query
          WHERE rank IN {ranks: Array(String)}
          ORDER BY rank;
        `,
        query_params: {
          ranks: ranks.map(String),
          seasonId,
          startTime: Math.floor(new Date('2025-10-06T05:00:00.000Z').getTime() / 1000),
        },
      })
      .then((res) => res.json<{ rank: string; trophies: string }>());

    return rows.data.map((row) => ({
      rank: Number(row.rank),
      minTrophies: Number(row.trophies),
    }));
  }

  private async redisJSON<T>(key: string) {
    try {
      const result = await this.redis.get(key);
      if (!result) return null;

      return JSON.parse(result) as T;
    } catch {
      return null;
    }
  }
}
