import { ClashClientService } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import { Util } from 'clashofclans.js';
import Redis from 'ioredis';
import { Db } from 'mongodb';
import { Collections, GO_REDIS_TOKEN, LegendAttacksEntity, MONGODB_TOKEN } from '../db';

@Injectable()
export class PlayersService {
  constructor(
    @Inject(GO_REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    private clashClientService: ClashClientService,
  ) {}

  async addPlayer(tag: string) {
    const player = await this.clashClientService.getPlayerOrThrow(tag);

    await this.redis.sadd('legend_player_tags', player.tag);

    const hasMigrated = await this.redis.sismember('migrated_legend_player_tags', player.tag);
    if (hasMigrated) return { message: 'already_migrated' };
    await this.redis.sadd('migrated_legend_player_tags', player.tag);

    if (Util.getSeasonId() !== '2025-10') return { message: 'no_longer_required' };

    const [season] = await this.db
      .collection('LegendAttacksOld')
      .aggregate<LegendAttacksEntity>([
        {
          $match: {
            tag: player.tag,
            seasonId: { $in: ['2025-09', '2025-10'] },
          },
        },
        {
          $unwind: {
            path: '$logs',
          },
        },
        {
          $group: {
            _id: '$tag',
            logs: {
              $push: '$logs',
            },
            streak: {
              $last: '$streak',
            },
            name: {
              $last: '$name',
            },
            tag: {
              $last: '$tag',
            },
            trophies: {
              $last: '$trophies',
            },
            initial: {
              $first: '$initial',
            },
            seasonId: {
              $last: '$seasonId',
            },
            attack_logs_last: {
              $last: '$attackLogs',
            },
            attack_logs_first: {
              $first: '$attackLogs',
            },
            defense_logs_last: {
              $last: '$defenseLogs',
            },
            defense_logs_first: {
              $first: '$defenseLogs',
            },
          },
        },
        {
          $set: {
            defenseLogs: {
              $mergeObjects: ['$defense_logs_first', '$defense_logs_last'],
            },
            attackLogs: {
              $mergeObjects: ['$attack_logs_first', '$attack_logs_last'],
            },
          },
        },
        {
          $unset: [
            '_id',
            'attack_logs_last',
            'attack_logs_first',
            'defense_logs_first',
            'defense_logs_last',
          ],
        },
      ])
      .toArray();

    if (!season) return { message: 'season_not_found' };

    season.logs.sort((a, b) => a.timestamp - b.timestamp);
    season.logs = season.logs.filter(
      (log) => new Date(log.timestamp).getTime() < new Date('2025-10-06T05:00:00.000Z').getTime(),
    );

    await this.db
      .collection(Collections.LEGEND_ATTACKS)
      .updateOne(
        { tag: player.tag, seasonId: '2025-09' },
        { $set: { ...season, seasonId: '2025-09' } },
        { upsert: true },
      );

    return { message: 'migrated' };
  }
}
