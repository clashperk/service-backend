import { ClashClientService } from '@app/clash-client';
import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable } from '@nestjs/common';
import { LEGEND_LEAGUE_ID } from 'clashofclans.js';
import Redis from 'ioredis';
import { Db } from 'mongodb';
import { CLICKHOUSE_TOKEN, GO_REDIS_TOKEN, MONGODB_TOKEN } from '../db';
import { BattleLogAggregateItemsDto, BattleLogDailyDto, BattleLogDto } from './dto';

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
        ORDER BY version
        LIMIT {limit: Int32}
      `,
      query_params: {
        playerTag,
        limit: 450,
      },
    });

    const rows = await result.json<BattleLogDto>();

    return {
      items: (rows.data || []).map((row) => ({
        ...row,
        ingestedAt: new Date(row.ingestedAt),
      })),
    };
  }

  async getPlayerBattleLogAggregate(playerTag: string): Promise<BattleLogAggregateItemsDto> {
    const result = await this.clickhouse.query({
      query: `
        SELECT
          battle_date AS battleDate,
          argMin(trophies, version) AS trophies,
          sumIf(trophy_change, is_attack = 1) AS offense,
          sumIf(trophy_change, is_attack = 0) AS defense,
          sum(trophy_change) AS gain
        FROM battle_logs FINAL
        WHERE player_tag = {playerTag: String}
          AND battle_type = 'legend'
        GROUP BY battleDate
        ORDER BY battleDate ASC
      `,
      query_params: { playerTag },
    });

    const rows = await result.json<BattleLogDailyDto>();
    return {
      items: (rows.data || []).map((row) => ({
        battleDate: row.battleDate,
        trophies: Number(row.trophies),
        offense: Number(row.offense),
        defense: Number(row.defense),
        gain: Number(row.gain),
      })),
    };
  }

  async addPlayer(tag: string) {
    const player = await this.clashClientService.getPlayerOrThrow(tag);
    await this.redis.sadd('legend_player_tags', player.tag);
    await this.redis.srem('banned_player_tags', player.tag);

    if (player?.leagueTier?.id === LEGEND_LEAGUE_ID) {
      await this.redis.srem('non_legend_player_tags', player.tag);
    }

    return { message: 'Ok' };
  }
}
