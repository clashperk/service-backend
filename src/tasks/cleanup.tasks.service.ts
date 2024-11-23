import { ClashClient } from '@app/clash-client';
import { Collections, Tokens } from '@app/constants';
import { ClanStoresEntity, PlayerLinksEntity } from '@app/entities';
import { ClanLogsEntity } from '@app/entities/clan-logs.entity';
import { RedisClient } from '@app/redis';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Collection } from 'mongodb';
import { cluster } from 'radash';

@Injectable()
export class CleanupTasksService {
  private logger = new Logger(CleanupTasksService.name);
  constructor(
    @Inject(Collections.CLAN_STORES)
    private readonly clanStoresEntity: Collection<ClanStoresEntity>,
    @Inject(Collections.CLAN_LOGS)
    private readonly clanLogsEntity: Collection<ClanLogsEntity>,
    @Inject(Collections.PLAYER_LINKS)
    private readonly linksEntity: Collection<PlayerLinksEntity>,
    @Inject(Collections.CLAN_GAMES_POINTS)
    private readonly clanGamesPointsEntity: Collection<PlayerLinksEntity>,

    @Inject(Tokens.CLASH_CLIENT) private readonly clashClient: ClashClient,
    @Inject(Tokens.REDIS) private readonly redis: RedisClient,
  ) {}

  public cleanupClans() {
    this._cleanupClans();
    return { status: 'processing' };
  }

  private async _cleanupClans() {
    const isProcessing = await this.redis.get('cleanup:clans');
    if (isProcessing) return { status: 'processing' };

    await this.redis.set('cleanup:clans', 'true', { EX: 60 * 60 * 24 });
    try {
      const clanTags = await this.clanStoresEntity.distinct('tag');
      this.logger.log(`Processing ${clanTags.length} clans`);

      let count = 0;
      for (const chunk of cluster(clanTags, 50)) {
        const responses = await Promise.all(
          chunk.map(async (tag) => {
            const { res } = await this.clashClient.getClan(tag);
            return {
              tag,
              status: res.status,
            };
          }),
        );

        for (const res of responses) {
          if (res.status === 404) {
            await this.clanStoresEntity.updateOne({ tag: res.tag }, { $set: { deleted: true } });
            await this.redis.sAdd('deleted:clans', res.tag);
          }
        }

        count += chunk.length;
        this.logger.log(`Processed ${count} clans`);
      }
    } finally {
      await this.redis.del('cleanup:clans');
    }

    this.logger.log('Cleanup clans completed');
    return { status: 'success' };
  }

  public linksCleanup() {
    this._linksCleanup();
    return { status: 'processing' };
  }

  private async _linksCleanup() {
    const isProcessing = await this.redis.get('cleanup:links');
    if (isProcessing) return { status: 'processing' };

    await this.redis.set('cleanup:links', 'true', { EX: 60 * 60 * 24 });
    try {
      const playerTags = await this.linksEntity.distinct('tag');
      this.logger.log(`Found ${playerTags.length} links`);

      let count = 0;
      for (const chunk of cluster(playerTags, 50)) {
        const responses = await Promise.all(
          chunk.map(async (tag) => {
            const { res } = await this.clashClient.getPlayer(tag);
            return {
              tag,
              status: res.status,
            };
          }),
        );

        for (const res of responses) {
          if (res.status === 404) {
            await this.linksEntity.updateOne({ tag: res.tag }, { $set: { deleted: true } });
            await this.redis.sAdd('deleted:links', res.tag);
          }
        }

        count += chunk.length;
        this.logger.log(`Processed ${count} links`);
      }
    } finally {
      await this.redis.del('cleanup:links');
    }

    this.logger.log('Links cleanup completed');
    return { status: 'success' };
  }

  public reSyncClanGamesPoints() {
    this._reSyncClanGamesPoints();
    return { status: 'processing' };
  }

  public async _reSyncClanGamesPoints() {
    const key = 'cleanup:clan-games-points';
    const isProcessing = await this.redis.get(key);
    if (isProcessing) return { status: 'processing' };

    await this.redis.set(key, 'true', { EX: 60 * 60 * 24 });

    try {
      const seasonId = this.clashClient.util.getSeasonId();
      await this.clanGamesPointsEntity.updateMany(
        { season: seasonId },
        { $set: { season: `${seasonId}-00` } },
      );
    } finally {
      await this.redis.del(key);
    }

    this.logger.log('Clan games points cleanup completed');
    return { status: 'success' };
  }
}
