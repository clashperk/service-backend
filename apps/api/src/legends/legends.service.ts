import { Season } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { GetLegendAttacksInputDto, LegendAttacksDto } from '../players/dto';

@Injectable()
export class LegendsService {
  constructor(@Inject(MONGODB_TOKEN) private db: Db) {}

  async getLegendAttacks(input: GetLegendAttacksInputDto) {
    const items = await this.db
      .collection(Collections.LEGEND_ATTACKS)
      .aggregate<LegendAttacksDto>([
        { $match: { tag: { $in: input.playerTags }, seasonId: Season.leagueId } },
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
}
