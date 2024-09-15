import { ClashClient } from '@app/clash-client';
import { Collections, Tokens } from '@app/constants';
import { ClanStoresEntity, PlayerLinksEntity } from '@app/entities';
import { ClanLogsEntity } from '@app/entities/clan-logs.entity';
import { RedisClient } from '@app/redis';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';
import { cluster } from 'radash';

@Injectable()
export class CleanupTasksService {
  constructor(
    @Inject(Collections.CLAN_STORES)
    private readonly clanStoresEntity: Collection<ClanStoresEntity>,
    @Inject(Collections.CLAN_LOGS)
    private readonly clanLogsEntity: Collection<ClanLogsEntity>,
    @Inject(Collections.PLAYER_LINKS)
    private readonly linksEntity: Collection<PlayerLinksEntity>,

    @Inject(Tokens.CLASH_CLIENT) private readonly clashClient: ClashClient,
    @Inject(Tokens.REDIS) private readonly redis: RedisClient,
  ) {}

  public async cleanupClans() {
    const isProcessing = await this.redis.get('cleanup:clans');
    if (isProcessing) return { status: 'processing' };

    await this.redis.set('cleanup:clans', 'true', { EX: 60 * 60 * 24 });
    try {
      const clanTags = await this.clanStoresEntity.distinct('tag');

      for (const tag of clanTags) {
        const { res, body } = await this.clashClient.getClan(tag);
        if (res.status === 404 || (res.ok && body?.members === 0)) {
          await this.redis.sAdd('deleted:clans', tag);
          await this.clanStoresEntity.updateMany({ tag }, { $set: { deleted: true } });
        }
      }
    } finally {
      await this.redis.del('cleanup:clans');
    }

    console.log('Cleanup clans completed');
    return { status: 'success' };
  }

  public async linksCleanup() {
    const isProcessing = await this.redis.get('cleanup:links');
    if (isProcessing) return { status: 'processing' };

    await this.redis.set('cleanup:links', 'true', { EX: 60 * 60 * 24 });
    try {
      const playerTags = await this.linksEntity.distinct('tag');

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
      }
    } finally {
      await this.redis.del('cleanup:links');
    }

    console.log('Links cleanup completed');
    return { status: 'success' };
  }
}
