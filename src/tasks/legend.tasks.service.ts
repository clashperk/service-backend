import { ClashClient } from '@app/clash-client';
import { Collections, Tokens } from '@app/constants';
import { LegendAttacksEntity } from '@app/entities/legend-attacks.entity';
import { RedisClient } from '@app/redis';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';

@Injectable()
export class LegendTasksService {
  constructor(
    @Inject(Collections.LEGEND_ATTACKS)
    private readonly legendAttacksCollection: Collection<LegendAttacksEntity>,
    @Inject(Tokens.CLASH_CLIENT) private readonly clashClient: ClashClient,
    @Inject(Tokens.REDIS) private readonly redis: RedisClient,
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
    const [result] = await this.legendAttacksCollection
      .aggregate<Record<string, number>>([
        {
          $match: {
            seasonId,
          },
        },
        {
          $project: {
            _id: 0,
            trophies: 1,
          },
        },
        {
          $sort: {
            trophies: -1,
          },
        },
        {
          $limit: limit,
        },
        {
          $group: {
            _id: null,
            trophies: {
              $push: '$trophies',
            },
          },
        },
        {
          $project: {
            _id: 0,
            ...ranks.reduce((acc, rank) => {
              acc[rank.toString()] = {
                $arrayElemAt: ['$trophies', rank - 1],
              };
              return acc;
            }, {}),
          },
        },
      ])
      .toArray();

    return Object.entries(result ?? {}).map(([rank, minTrophies]) => ({
      rank: Number(rank),
      minTrophies,
    }));
  }
}
