import { Season } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { GetLegendAttacksInputDto, LegendAttacksDto } from '../players/dto';
import { LegendSeasonDto } from './dto';

@Injectable()
export class LegendsService {
  constructor(@Inject(MONGODB_TOKEN) private db: Db) {}

  async getLegendAttacks(input: GetLegendAttacksInputDto, seasonId = Season.leagueId) {
    const items = await this.db
      .collection(Collections.LEGEND_ATTACKS)
      .aggregate<LegendAttacksDto>([
        { $match: { tag: { $in: input.playerTags }, seasonId } },
        {
          $project: {
            _id: 0,
            tag: 1,
            name: 1,
            seasonId: 1,
            trophies: 1,
            logs: {
              $map: {
                input: '$logs',
                as: 'log',
                in: {
                  timestamp: '$$log.timestamp',
                  start: '$$log.start',
                  end: '$$log.end',
                  diff: '$$log.inc',
                  type: '$$log.type',
                },
              },
            },
          },
        },
      ])
      .toArray();

    return { items };
  }

  /** A player's last 6 seasons in Legend League, newest first, totalled from their logs. */
  async getLegendSeasons(playerTag: string): Promise<LegendSeasonDto[]> {
    const total = (type: string) => ({
      $sum: {
        $map: {
          input: { $filter: { input: '$logs', as: 'log', cond: { $eq: ['$$log.type', type] } } },
          as: 'log',
          in: '$$log.inc',
        },
      },
    });
    return this.db
      .collection(Collections.LEGEND_ATTACKS)
      .aggregate<LegendSeasonDto>([
        { $match: { tag: playerTag } },
        { $sort: { seasonId: -1 } },
        { $limit: 6 },
        {
          $project: {
            _id: 0,
            seasonId: 1,
            initial: 1,
            trophies: 1,
            attackTrophies: total('attack'),
            defenseTrophies: total('defense'),
          },
        },
      ])
      .toArray();
  }
}
