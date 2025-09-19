import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, GLOBAL_MONGODB_TOKEN, GlobalClanHistoryEntity } from '../../db';

@Injectable()
export class GlobalService {
  constructor(@Inject(GLOBAL_MONGODB_TOKEN) private db: Db) {}

  async getPlayerClanHistory(playerTag: string) {
    const items = await this.db
      .collection(Collections.GLOBAL_CLAN_HISTORY)
      .aggregate<GlobalClanHistoryEntity>([
        {
          $match: {
            playerTag,
          },
        },
        {
          $lookup: {
            from: Collections.GLOBAL_CLANS,
            localField: 'clanTag',
            foreignField: 'tag',
            as: 'clan',
          },
        },
        {
          $unwind: {
            path: '$clan',
          },
        },
        {
          $sort: {
            lastSeen: -1,
          },
        },
        {
          $project: {
            '_id': 0,
            'clanTag': 0,
            'trackingId': 0,
            'clan._id': 0,
            'clan.level': 0,
            'clan.teamSize': 0,
            'clan.createdAt': 0,
          },
        },
      ])
      .toArray();

    return { items };
  }
}
