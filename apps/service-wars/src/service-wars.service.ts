import { MongoDbService, TrackedClanList } from '@app/mongodb';
import { PlayersRepository } from '@app/repositories';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WarsService {
  constructor(
    private configService: ConfigService,
    private mongoDbService: MongoDbService,
    private playersRepository: PlayersRepository,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  private logger = new Logger(WarsService.name);
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
        await this.fetchClanWar(clanTag);
      }
    } finally {
      setTimeout(() => this.startPolling.bind(this), this.pollingInterval).unref();
    }
  }

  private async fetchClanWar(clanTag: string) {
    if (clanTag) return null;
  }
}
