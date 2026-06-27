import { ClashClient, ClashClientService } from '@app/clash-client';
import { RedisChannels, WorkerEvents } from '@app/constants';
import { formatDuration, isValidWorker } from '@app/helpers';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN, REDIS_SUB_TOKEN } from './db';
import { Emitter } from './util/emitter';

@Injectable()
export class WorkerService {
  public startTime: Date | null;
  public isInMaintenance: boolean;

  private clans = new Set<string>();
  private logger = new Logger(WorkerService.name);
  private clashClient: ClashClient;

  constructor(
    @Inject(REDIS_SUB_TOKEN) private subscriber: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    private eventEmitter: Emitter,
    private clashClientService: ClashClientService,
  ) {
    this.clashClient = this.clashClientService.getClient();
    this.isInMaintenance = false;
    this.startTime = null;
  }

  async onApplicationBootstrap() {
    await this.subscriber.subscribe(RedisChannels.CLAN_ADDED, RedisChannels.CLAN_REMOVED);

    this.subscriber.on('message', (channel: RedisChannels, message) => {
      if (channel === RedisChannels.CLAN_ADDED) {
        const data = JSON.parse(message);
        this.clans.add(data.tag);

        if (isValidWorker(data.uniqueId)) {
          this.eventEmitter.emit(WorkerEvents.CLAN_ADDED, data);
        }
      }

      if (channel === RedisChannels.CLAN_REMOVED) {
        const data = JSON.parse(message);
        this.clans.delete(data.tag);

        if (isValidWorker(data.uniqueId)) {
          this.eventEmitter.emit(WorkerEvents.CLAN_REMOVED, data);
        }
      }
    });

    this.eventEmitter.emit(WorkerEvents.WORKER_STARTED);
  }

  @OnEvent(WorkerEvents.WORKER_STARTED)
  async onWorkerInit() {
    await this.loadClans();
  }

  async loadClans() {
    const result = await this.db
      .collection(Collections.CLAN_STORES)
      .aggregate<{ tag: string; lastRan: Date; uniqueId: number }>([
        {
          $match: {
            paused: false,
          },
        },
        {
          $group: {
            _id: '$tag',
            uniqueId: {
              $max: '$uniqueId',
            },
            lastRan: {
              $max: '$lastRan',
            },
          },
        },
        {
          $set: {
            tag: '$_id',
          },
        },
      ])
      .toArray();

    for (const data of result) {
      data.lastRan ??= new Date(0);
      this.clans.add(data.tag);
    }

    const clans = result.filter((clan) => isValidWorker(clan.uniqueId));
    clans.sort((a, b) => new Date(a.lastRan).getTime() - new Date(b.lastRan).getTime());

    this.eventEmitter.emit(WorkerEvents.CLANS_LOADED, clans);
    this.logger.debug(`Store Initialized ${clans.length}/${this.clans.size}`);
  }

  @OnEvent(WorkerEvents.WORKER_STARTED)
  public async maintenanceChecker() {
    try {
      const { res } = await this.clashClient.getClans({
        minMembers: Math.floor(Math.random() * 40) + 10,
        limit: 1,
      });
      if (res.status === 503 && !this.isInMaintenance) {
        this.isInMaintenance = true;
        this.startTime = new Date();
        this.logger.debug('Maintenance started');
      }

      if (res.status === 200 && this.isInMaintenance) {
        const duration = Date.now() - (this.startTime?.getTime() ?? Date.now());
        if (duration > 60_000) {
          this.isInMaintenance = false;
          this.startTime = null;
          this.logger.debug(`Maintenance ended after ${formatDuration(duration)}`);
        }
      }
    } finally {
      setTimeout(this.maintenanceChecker.bind(this), 30_000);
    }
  }

  has(tag: string) {
    return this.clans.has(tag);
  }
}
