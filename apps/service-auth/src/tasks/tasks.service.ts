import { ClashClient } from '@app/clash-client';
import { Collections, Tokens } from '@app/constants';
import { LegendAttacksEntity } from '@app/entities/legend-attacks.entity';
import { RedisClient } from '@app/redis';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';

@Injectable()
export class TasksService {
  constructor(
    @Inject(Collections.LEGEND_ATTACKS)
    private readonly legendAttacksCollection: Collection<LegendAttacksEntity>,
    @Inject(Tokens.CLASH_CLIENT) private readonly clashClient: ClashClient,
    @Inject(Tokens.REDIS) private readonly redis: RedisClient,
  ) {}

  public async backfillLegendTrophyThreshold() {
    const thresholds = await this.getTrophyThresholds();
    await this.redis.set('RAW:LEGEND-TROPHY-THRESHOLD', JSON.stringify(thresholds), {
      EX: 60 * 60 * 24,
    });
    return thresholds; // legend-trophy-threshold
  }

  public async getTrophyThresholds() {
    const seasonId = this.clashClient.util.getSeasonId();
    const [result] = await this.legendAttacksCollection
      .aggregate<Record<string, number>>([
        {
          $match: {
            seasonId,
          },
        },
        {
          $sort: {
            trophies: -1,
          },
        },
        {
          $limit: 1000,
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
            '1': {
              $arrayElemAt: ['$trophies', 0],
            },
            '3': {
              $arrayElemAt: ['$trophies', 2],
            },
            '10': {
              $arrayElemAt: ['$trophies', 9],
            },
            '20': {
              $arrayElemAt: ['$trophies', 19],
            },
            '50': {
              $arrayElemAt: ['$trophies', 49],
            },
            '100': {
              $arrayElemAt: ['$trophies', 99],
            },
            '200': {
              $arrayElemAt: ['$trophies', 199],
            },
            '500': {
              $arrayElemAt: ['$trophies', 499],
            },
            '1000': {
              $arrayElemAt: ['$trophies', 999],
            },
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
