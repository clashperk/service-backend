import { ClashClient } from '@app/clash-client';
import { CLICKHOUSE_CLIENT } from '@app/clickhouse';
import { Tokens } from '@app/constants';
import { RedisClient } from '@app/redis';
import { NodeClickHouseClient } from '@clickhouse/client/dist/client';
import { Inject, Injectable } from '@nestjs/common';
import moment from 'moment';

@Injectable()
export class LegendTasksService {
  constructor(
    @Inject(Tokens.CLASH_CLIENT) private readonly clashClient: ClashClient,
    @Inject(Tokens.REDIS) private readonly redis: RedisClient,
    @Inject(CLICKHOUSE_CLIENT) private readonly clickhouseClient: NodeClickHouseClient,
  ) {}

  public async backfillLegendTrophyThreshold() {
    const thresholds = await this.getTrophyThresholds();
    const timestamp = new Date().toISOString();
    const keyPrefix = 'RAW:LEGEND-TROPHY-THRESHOLD';
    const key = `${keyPrefix}:${timestamp.slice(0, 10)}`;
    const payload = JSON.stringify({ timestamp: new Date().toISOString(), thresholds });

    await this.redis
      .multi()
      .set(keyPrefix, payload, {
        EX: 60 * 60 * 24 + 60 * 5, // 1 day + 5 minutes
      })
      .set(key, payload, {
        EX: 30 * 60 * 60 * 24 + 60 * 5, // 30 days + 5 minutes
      })
      .exec();

    return thresholds;
  }

  public async getTrophyThresholds() {
    const key = 'CACHED:LEGEND-TROPHY-THRESHOLD';
    const cached = await this.getCachedTrophyThresholds(key);
    if (cached) return cached;

    const result = await this.aggregateTrophyThreshold();

    await this.redis.set(key, JSON.stringify(result), {
      EX: 60 * 10, // 10 minutes
    });

    return result;
  }

  public async getTrophyHistoricalThresholds() {
    const { endTime, startTime } = this.clashClient.util.getSeason();
    const timestamps = Array.from({ length: moment(endTime).diff(startTime, 'days') + 1 }, (_, i) =>
      moment(startTime).add(i, 'days'),
    ).filter((mts) => mts.isSameOrBefore(moment()));

    const thresholdRecords = await this.redis.mGet(
      timestamps.map((mts) => `RAW:LEGEND-TROPHY-THRESHOLD:${mts.format('YYYY-MM-DD')}`),
    );

    const thresholds = thresholdRecords
      .filter((result) => result !== null)
      .map((result) => JSON.parse(result as string));

    return thresholds;
  }

  private async getCachedTrophyThresholds(key: string) {
    try {
      const result = await this.redis.get(key);
      if (!result) return null;

      return JSON.parse(result) as { rank: number; minTrophies: number }[];
    } catch {
      return null;
    }
  }

  private async aggregateTrophyThreshold() {
    const limit = 50000;
    const ranks = [1, 3, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].filter(
      (rank) => rank <= limit,
    );

    const seasonId = this.clashClient.util.getSeasonId();

    const rows = await this.clickhouseClient
      .query({
        query: `
            WITH ranked AS (
              SELECT
                trophies,
                streak,
                seasonId,
                row_number() OVER (PARTITION BY seasonId ORDER BY trophies DESC) AS rank
              FROM legend_players
              FINAL
              WHERE seasonId = {seasonId: String} AND createdAt >= toStartOfDay(now() - INTERVAL 1 DAY)
            )
            SELECT *
            FROM ranked
            WHERE rank IN {ranks: Array(String)}
            ORDER BY rank;
          `,
        query_params: { ranks: ranks.map(String), seasonId },
      })
      .then((res) => res.json<{ rank: string; trophies: string }>());

    return rows.data.map((row) => ({
      rank: Number(row.rank),
      minTrophies: Number(row.trophies),
    }));
  }
}
