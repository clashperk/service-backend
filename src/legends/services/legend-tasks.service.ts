import { ClickHouseClient } from '@clickhouse/client';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Util } from 'clashofclans.js';
import Redis from 'ioredis';
import moment from 'moment';
import { CLICKHOUSE_TOKEN, REDIS_TOKEN } from '../../db';
import { LegendRankingThresholdsSnapShotDto, ThresholdsDto } from '../../tasks/dto';

const SNAPSHOT_TTL = 60 * 60 * 24 + 60 * 5; // 1 day + 5 minutes
const HISTORICAL_SNAPSHOT_TTL = 45 * 60 * 60 * 24 + 60 * 5; // 45 days + 5 minutes

const POSSIBLE_RANKS = [
  1, 3, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 99800, 99900, 99990,
  100000,
];
const MAX_LIMIT = 100000;

@Injectable()
export class LegendTasksService {
  private logger = new Logger(LegendTasksService.name);
  constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(CLICKHOUSE_TOKEN) private clickhouseClient: ClickHouseClient,
  ) {}

  public async takeSnapshot() {
    this.logger.log('Taking legend ranks snapshot...');
    const thresholds = await this.getRanksThresholds();

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

  public async getRanksThresholds() {
    return await this.aggregateRanksThresholds();
  }

  public async getEoDThresholds() {
    const key = 'RAW:LEGEND-RANKS';
    const result = await this.redisJSON<LegendRankingThresholdsSnapShotDto>(key);
    if (!result) return null;

    return result;
  }

  public async getHistoricalRanksThresholds() {
    const timestamps = Array.from({ length: 45 }, (_, i) => moment().subtract(i, 'days'))
      .filter((mts) => mts.isSameOrBefore(moment()))
      .reverse();

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
    const { seasonId, startTime } = Util.getSeason();

    const rows = await this.clickhouseClient
      .query({
        query: `
          WITH ranking_query AS (
            SELECT
              trophies,
              tag,
              seasonId,
              ROW_NUMBER() OVER (
                PARTITION BY seasonId
                ORDER BY trophies DESC, createdAt DESC
              ) AS rank
            FROM legend_players
            FINAL
            WHERE seasonId = {seasonId: String} AND createdAt >= {startTime: DateTime}
          )
          SELECT *
          FROM ranking_query
          WHERE rank IN {ranks: Array(String)}
          ORDER BY rank;
        `,
        query_params: {
          ranks: ranks.map(String),
          seasonId,
          startTime: Math.floor((startTime.getTime() + 60 * 60 * 1000) / 1000),
        },
      })
      .then((res) => res.json<{ rank: string; trophies: string; tag: string }>());

    return rows.data.map((row) => ({
      tag: row.tag,
      rank: Number(row.rank),
      minTrophies: Number(row.trophies),
    }));
  }

  public async getRanksByPlayerTags(tags: string[]) {
    const { seasonId, startTime } = Util.getSeason();

    const rows = await this.clickhouseClient
      .query({
        query: `
          WITH ranking_query AS (
            SELECT
              name,
              tag,
              trophies,
              seasonId,
              ROW_NUMBER() OVER (
                PARTITION BY seasonId
                ORDER BY trophies DESC, createdAt DESC
              ) AS rank
            FROM legend_players
            FINAL
            WHERE seasonId = {seasonId: String} AND createdAt >= {startTime: DateTime}
          )
          SELECT
            name,
            tag,
            trophies,
            rank
          FROM ranking_query
          WHERE tag IN {tags: Array(String)};
        `,
        query_params: {
          tags,
          seasonId,
          startTime: Math.floor((startTime.getTime() + 60 * 60 * 1000) / 1000),
        },
      })
      .then((res) => res.json<{ rank: number; trophies: number; name: string; tag: string }>());

    return rows.data.map((row) => ({
      tag: row.tag,
      name: row.name,
      rank: Number(row.rank),
      trophies: row.trophies,
    }));
  }

  public async getRanksByRange(minRank: number, maxRank: number) {
    const { seasonId, startTime } = Util.getSeason();

    const maxDiff = 1000;
    if (maxRank < minRank) {
      throw new BadRequestException('Invalid rank range. maxRank must be greater than minRank.');
    }
    if (maxRank - minRank > maxDiff) {
      throw new BadRequestException(`Range too large. Max difference is ${maxDiff} ranks.`);
    }

    const rows = await this.clickhouseClient
      .query({
        query: `
          WITH ranking_query AS (
            SELECT
              name,
              tag,
              trophies,
              seasonId,
              row_number() OVER (PARTITION BY seasonId ORDER BY trophies DESC) AS rank
            FROM legend_players
            FINAL
            WHERE seasonId = {seasonId: String} AND createdAt >= {startTime: DateTime}
          )
          SELECT
            name,
            tag,
            trophies,
            rank
          FROM ranking_query
          WHERE rank BETWEEN {minRank: Int32} AND {maxRank: Int32}
          ORDER BY rank;
        `,
        query_params: {
          minRank,
          maxRank,
          seasonId,
          startTime: Math.floor((startTime.getTime() + 60 * 60 * 1000) / 1000),
        },
      })
      .then((res) => res.json<{ rank: number; trophies: number; name: string; tag: string }>());

    return rows.data.map((row) => ({
      tag: row.tag,
      name: row.name,
      rank: Number(row.rank),
      trophies: row.trophies,
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
