import { ClashClientService } from '@app/clash-client';
import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { Db } from 'mongodb';
import { CLICKHOUSE_TOKEN, GO_REDIS_TOKEN, MONGODB_TOKEN } from '../db';
import { BattleLogDto } from './dto';

@Injectable()
export class PlayersService {
  constructor(
    @Inject(GO_REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    private clashClientService: ClashClientService,
    @Inject(CLICKHOUSE_TOKEN) private clickhouse: ClickHouseClient,
  ) {}

  async getPlayerBattleLog(playerTag: string) {
    const result = await this.clickhouse.query({
      query: `
        SELECT
          player_tag as playerTag,
          opponent_tag as opponentTag,
          battle_type as battleType,
          toBool(is_attack) as isAttack,
          stars,
          destruction,
          trophies,
          trophy_change as trophyChange,
          battle_date as battleDate,
          ingested_at as ingestedAt
        FROM battle_logs FINAL
        WHERE player_tag = {playerTag: String}
        ORDER BY version LIMIT {limit: Int32}
      `,
      query_params: {
        playerTag,
        limit: 300,
      },
    });

    const rows = await result.json<BattleLogDto>();

    return { items: (rows.data || []).reverse() };
  }

  async addPlayer(tag: string) {
    const player = await this.clashClientService.getPlayerOrThrow(tag);
    await this.redis.sadd('legend_player_tags', player.tag);

    return { message: 'Ok' };
  }
}
