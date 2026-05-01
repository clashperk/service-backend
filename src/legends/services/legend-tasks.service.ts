import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Util } from 'clashofclans.js';
import Redis from 'ioredis';
import moment from 'moment';
import { CLICKHOUSE_TOKEN, REDIS_TOKEN } from '../../db';
import { LegendRankingThresholdsSnapShotDto, ThresholdsDto } from '../../tasks/dto';

const SNAPSHOT_TTL = 60 * 60 * 24 + 60 * 5; // 1 day + 5 minutes
const HISTORICAL_SNAPSHOT_TTL = 45 * 60 * 60 * 24 + 60 * 5; // 45 days + 5 minutes

const POSSIBLE_RANKS = [
  1, 3, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 9500,
  10000, 10500, 12500, 20000, 50000, 80000, 100000,
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
    const { seasonId } = Util.getSeason();

    const rows = await this.clickhouseClient
      .query({
        query: `
          WITH ranking_query AS (
            SELECT
              trophies,
              player_tag,
              battle_season,
              ROW_NUMBER() OVER (
                PARTITION BY battle_season
                ORDER BY trophies DESC
              ) AS rank
            FROM legend_players_projected
            FINAL
            WHERE battle_season = {seasonId: String}
          )
          SELECT *
          FROM ranking_query
          WHERE rank IN {ranks: Array(String)}
          ORDER BY rank;
        `,
        query_params: {
          ranks: ranks.map(String),
          seasonId,
        },
      })
      .then((res) => res.json<{ rank: string; trophies: string; player_tag: string }>());

    return rows.data.map((row) => ({
      tag: row.player_tag,
      rank: Number(row.rank),
      minTrophies: Number(row.trophies),
    }));
  }

  public async getRanksByPlayerTags(tags: string[]) {
    const { seasonId } = Util.getSeason();

    const rows = await this.clickhouseClient
      .query({
        query: `
          SELECT
            player_name,
            player_tag,
            trophies,
            rank
          FROM legend_players_ranked
          WHERE player_tag IN {tags: Array(String)}
        `,
        query_params: {
          tags,
          seasonId,
        },
      })
      .then((res) =>
        res.json<{ rank: number; trophies: number; player_name: string; player_tag: string }>(),
      );

    return rows.data.map((row) => ({
      tag: row.player_tag,
      name: row.player_name,
      rank: Number(row.rank),
      trophies: row.trophies,
    }));
  }

  public async calculateRanks() {
    await this.clickhouseClient.query({
      query: `TRUNCATE TABLE legend_players_ranked_projected`,
    });

    await this.clickhouseClient.query({
      query: `
        INSERT INTO legend_players_ranked_projected
        SELECT
          player_tag,
          player_name,
          battle_season,
          trophies,
          ROW_NUMBER() OVER (
            PARTITION BY battle_season
            ORDER BY trophies DESC
          ) AS rank,
          now() AS updated_at
        FROM legend_players_projected
        WHERE battle_season = {seasonId: String};
      `,
      query_params: {
        seasonId: Util.getSeason().seasonId,
      },
    });

    await this.clickhouseClient.query({
      query: `
        ALTER TABLE legend_players_ranked
        REPLACE PARTITION {seasonId: String}
        FROM legend_players_ranked_projected;
      `,
      query_params: {
        seasonId: Util.getSeason().seasonId,
      },
    });

    // await this.clickhouseClient.query({
    //   query: `
    //     ALTER TABLE legend_players_ranked
    //     DROP PARTITION '2026-04';
    //   `,
    //   query_params: {
    //     seasonId: Util.getSeason().seasonId,
    //   },
    // });

    this.logger.log('Calculated legend ranks snapshot');
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
