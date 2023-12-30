import { Collections, Tokens } from '@app/constants';
import { LastSeenEntity } from '@app/entities';
import { MongoDbService, TrackedClanList } from '@app/mongodb';
import { RedisClient, RedisService } from '@app/redis';
import RestHandler from '@app/rest/rest.module';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, Db } from 'mongodb';

@Injectable()
export class ClansService {
  constructor(
    private configService: ConfigService,
    @Inject(Tokens.MONGODB) private db: Db,
    @Inject(Tokens.REDIS) private redis: RedisClient,
    @Inject(Tokens.REST) private restHandler: RestHandler,
    private redisService: RedisService,
    private mongoDbService: MongoDbService,

    @Inject(Collections.LAST_SEEN)
    private lastSeenCollection: Collection<LastSeenEntity>,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  private logger = new Logger(ClansService.name);
  private cached = new Map<string, TrackedClanList>();
  private pollingInterval = 1 * 60 * 1000; // 1 minute

  protected onApplicationBootstrap() {
    const disabled = this.configService.get('SERVICE_WARS_DISABLED');
    if (!disabled) this.init(); // Start polling from the API
  }

  private async init() {
    this.logger.debug('Loading clans...');
    await this.loadClans();

    this.logger.debug('Start polling...');
    await this.startPolling();
  }

  private async loadClans() {
    const clans = await this.mongoDbService.getTrackedClans();
    for (const clan of clans) this.cached.set(clan.tag, clan);
  }

  private async startPolling() {
    try {
      for (const clanTag of this.cached.keys()) {
        await this.fetchClan(clanTag);
      }
    } finally {
      setTimeout(() => this.startPolling.bind(this), this.pollingInterval).unref();
    }
  }

  private async fetchClan(clanTag: string) {
    if (clanTag) return null;
  }
}
