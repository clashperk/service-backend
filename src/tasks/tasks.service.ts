import { ClashClientService } from '@app/clash-client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { APICursors } from 'clashofclans.js';
import Redis from 'ioredis';
import { isNil, omitBy } from 'lodash';
import { GO_REDIS_TOKEN } from '../db';

@Injectable()
export class TasksService {
  private logger = new Logger(TasksService.name);

  constructor(
    private clashClientService: ClashClientService,
    @Inject(GO_REDIS_TOKEN) private redis: Redis,
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
}
