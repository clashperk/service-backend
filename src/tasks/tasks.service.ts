import { ClashClientService } from '@app/clash-client';
import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { APICursors } from 'clashofclans.js';
import Redis from 'ioredis';
import { isNil, omitBy } from 'lodash';
import { Db } from 'mongodb';
import { CLICKHOUSE_TOKEN, Collections, GO_REDIS_TOKEN, MONGODB_TOKEN } from '../db';

@Injectable()
export class TasksService {
  private logger = new Logger(TasksService.name);

  constructor(
    private clashClientService: ClashClientService,
    @Inject(GO_REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    @Inject(CLICKHOUSE_TOKEN) private clickhouse: ClickHouseClient,
  ) {}

  async bulkAddLegendPlayers() {
    const cursors = {} as APICursors;
    let totalFetched = 0;
    const maxLimit = 150_000;

    while (totalFetched < maxLimit) {
      const {
        res,
        body: { items, paging },
      } = await this.clashClientService.getSeasonRankings(
        '2025-09',
        omitBy(
          {
            limit: 10_000,
            after: cursors?.after,
          },
          isNil,
        ),
      );
      if (!res.ok || !items.length) break;

      cursors.after = paging.cursors?.after;
      totalFetched += items.length;

      this.logger.debug(`Fetched: ${items.length}; Total: ${totalFetched}`);
      await this.redis.sadd('legend_player_tags', ...items.map((i) => i.tag));

      if (totalFetched >= maxLimit) break;
    }

    return { message: 'Ok', totalFetched };
  }

  async seedLegendPlayers() {
    const playerTags = await this.redis.sdiff('legend_player_tags', 'banned_player_tags');
    if (!playerTags.length) {
      this.logger.debug('No player tags found in Redis set.');
      return { message: 'No player tags found' };
    }

    this.logger.debug(`Total player tags fetched from Redis: ${playerTags.length}`);

    const missingTags: string[] = [];

    const players = await this.db
      .collection(Collections.LEGEND_ATTACKS)
      .find({ seasonId: '2025-10', tag: { $in: playerTags } }, { projection: { tag: 1 } })
      .toArray();

    if (!players.length) {
      this.logger.debug('No existing players found in MongoDB.');
      return { message: 'No existing players found' };
    }

    this.logger.debug(`Existing players in MongoDB: ${players.length}`);

    const existingTags = new Set(players.map(({ tag }) => tag));

    for (const tag of playerTags) {
      if (!existingTags.has(tag)) missingTags.push(tag);
    }

    this.logger.debug(`Total players: ${playerTags.length}; Missing: ${missingTags.length}`);

    const values: ClickHousePlayersEntity[] = [];
    for (const tag of missingTags) {
      const body = await this.clashClientService.getPlayer(tag);
      if (body) {
        values.push({
          tag: body.tag,
          name: body.name,
          trophies: body.trophies,
          seasonId: '2025-10',
          streak: 0,
          createdAt: Date.now(),
        });
      }
    }

    if (!values.length) {
      this.logger.debug('No new players to insert into ClickHouse.');
      return { message: 'No new players to insert' };
    }

    await this.clickhouse.insert({
      table: 'legend_players',
      format: 'JSONEachRow',
      values,
    });

    this.logger.debug(`Inserted players into ClickHouse: ${values.length}`);
    return { message: 'Ok', inserted: values.length };
  }
}

interface ClickHousePlayersEntity {
  tag: string;
  name: string;
  trophies: number;
  seasonId: string;
  streak: number;
  createdAt: number;
}
