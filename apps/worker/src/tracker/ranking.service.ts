import { ClashClient, ClashClientService, Season } from '@app/clash-client';
import { RedisKeys, WorkerEvents } from '@app/constants';
import { formatDuration } from '@app/helpers';
import { Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { AnyBulkWriteOperation, Db } from 'mongodb';
import { Collections, MONGODB_TOKEN, REDIS_TOKEN } from '../db';
import { WorkerService } from '../worker.service';

export class RankingService {
  private logger = new Logger(RankingService.name);
  private refreshInterval = 5 * 60 * 1000;
  private clashClient: ClashClient;

  public constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    private workerService: WorkerService,
    private clashClientService: ClashClientService,
  ) {
    this.clashClient = this.clashClientService.getClient();
  }

  async playerRanks() {
    const { body, res } = await this.clashClient.getLocations();
    if (!res.ok) return;

    const operations: AnyBulkWriteOperation[] = [];
    body.items.push({ id: 0, name: 'Global', countryCode: 'global', isCountry: true });

    for (const location of body.items) {
      if (!location.countryCode) continue;

      try {
        const { body, res } = await this.clashClient.getPlayerRanks(
          location.id === 0 ? 'global' : location.id,
        );
        if (!res.ok) continue;
        if (!body.items.length) continue;

        operations.push({
          updateOne: {
            filter: { countryCode: location.countryCode, season: Season.ID },
            update: {
              $set: {
                country: location.name,
                players: body.items.map(({ tag, name, rank, trophies }) => ({
                  tag,
                  name,
                  rank,
                  trophies,
                })),
              },
            },
            upsert: true,
          },
        });
      } catch (err) {
        console.error(err);
      }
    }

    if (operations.length) {
      await this.db.collection(Collections.PLAYER_RANKS).bulkWrite(operations, { ordered: false });
    }
  }

  async capitalRanks() {
    const { body, res } = await this.clashClient.getLocations();
    if (!res.ok) return;

    const operations: AnyBulkWriteOperation[] = [];
    body.items.push({ id: 0, name: 'Global', countryCode: 'global', isCountry: true });

    for (const location of body.items) {
      if (!location.countryCode) continue;

      try {
        const { body, res } = await this.clashClient.getClanCapitalRanks(
          location.id === 0 ? 'global' : location.id,
        );
        if (!res.ok) continue;
        if (!body.items.length) continue;

        operations.push({
          updateOne: {
            filter: { countryCode: location.countryCode, season: Season.ID },
            update: {
              $set: {
                country: location.name,
                clans: body.items.map(({ tag, name, rank, clanCapitalPoints }) => ({
                  tag,
                  name,
                  rank,
                  clanCapitalPoints,
                })),
              },
            },
            upsert: true,
          },
        });
      } catch (err) {
        console.error(err);
      }
    }

    if (operations.length) {
      await this.db.collection(Collections.CAPITAL_RANKS).bulkWrite(operations, { ordered: false });
    }
  }

  async clanRanks() {
    const { body, res } = await this.clashClient.getLocations();
    if (!res.ok) return;

    const operations: AnyBulkWriteOperation[] = [];
    body.items.push({ id: 0, name: 'Global', countryCode: 'global', isCountry: true });

    for (const location of body.items) {
      if (!location.countryCode) continue;

      try {
        const { body, res } = await this.clashClient.getClanRanks(
          location.id === 0 ? 'global' : location.id,
        );
        if (!res.ok) continue;
        if (!body.items.length) continue;

        operations.push({
          updateOne: {
            filter: { countryCode: location.countryCode, season: Season.ID },
            update: {
              $set: {
                country: location.name,
                clans: body.items.map(({ tag, name, rank, clanPoints }) => ({
                  tag,
                  name,
                  rank,
                  clanPoints,
                })),
              },
            },
            upsert: true,
          },
        });
      } catch (err) {
        console.error(err);
      }
    }

    if (operations.length) {
      await this.db.collection(Collections.CLAN_RANKS).bulkWrite(operations, { ordered: false });
    }
  }

  @OnEvent(WorkerEvents.WORKER_STARTED)
  async onWorkerInit(debug = true) {
    if (process.env.RANKING_TRACKING !== '1') return;

    if ((process.env.DEBUG || debug) && !this.workerService.isInMaintenance) {
      this.logger.debug(`Starting Requests (Ranking)`);
    }
    const startTime = Date.now();

    try {
      if (!this.workerService.isInMaintenance) {
        await this.playerRanks();
        await this.clanRanks();
        await this.capitalRanks();
      }

      if (!this.workerService.isInMaintenance) {
        await this.redis.hset(
          RedisKeys.LOOP_TIMINGS,
          RedisKeys.RANKING_LOOP,
          JSON.stringify({ timeTaken: Date.now() - startTime, timestamp: Date.now() }),
        );
      }
    } finally {
      const timeTaken = Date.now() - startTime;
      if ((process.env.DEBUG || debug) && !this.workerService.isInMaintenance) {
        this.logger.verbose(`Finished Requests [${formatDuration(timeTaken)}] (Ranking)`);
      }

      setTimeout(
        this.onWorkerInit.bind(this),
        (timeTaken >= this.refreshInterval ? 0 : this.refreshInterval - timeTaken) + 60000,
        false,
      );
    }
  }
}
