import { ClashClientService } from '@app/clash-client';
import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { LEGEND_LEAGUE_ID } from 'clashofclans.js';
import Redis from 'ioredis';
import { chunk } from 'lodash';
import { Db } from 'mongodb';
import { CLICKHOUSE_TOKEN, GO_REDIS_TOKEN, MONGODB_TOKEN } from '../db';
import {
  BattleLogAggregateItemsDto,
  BattleLogDailyDto,
  BattleLogDto,
  BattleLogLeaderboardDto,
  BattleLogLeaderboardInputDto,
} from './dto';

@Injectable()
export class PlayersService {
  private logger = new Logger(PlayersService.name);
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
          player_name as name,
          player_tag as tag,
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

  async getBattleLogLeaderboard({
    playerTags,
    battleDate,
  }: BattleLogLeaderboardInputDto): Promise<BattleLogLeaderboardDto> {
    const results = await Promise.all(
      chunk(playerTags, 200).map((chunk) =>
        this.clickhouse
          .query({
            query: `
        SELECT
          player_tag AS tag,
          argMin(player_name, version) AS name,
          argMin(trophies, version) AS trophies
        FROM battle_logs
        WHERE player_tag IN {playerTags: Array(String)}
          AND battle_date = {battleDate: String}
          AND battle_type = 'legend'
        GROUP BY player_tag
        ORDER BY trophies DESC
      `,
            query_params: { playerTags: chunk, battleDate },
          })
          .then((res) => res.json<{ tag: string; name: string; trophies: string }>()),
      ),
    );

    const rows = results.flatMap((r) => r.data || []);
    return {
      items: rows.map((row) => ({
        tag: row.tag,
        name: row.name,
        trophies: Number(row.trophies),
      })),
    };
  }

  async addPlayer(tag: string) {
    const player = await this.clashClientService.getPlayerOrThrow(tag);
    await this.redis.sadd('legend_player_tags', player.tag);
    await this.redis.srem('banned_player_tags', player.tag);

    if (player?.leagueTier && player.leagueTier.id >= LEGEND_LEAGUE_ID) {
      await this.redis.srem('non_legend_player_tags', player.tag);
    }

    return { message: 'Ok' };
  }

  async updateLegendBattleLogs(playerTags: string[]) {
    const tags = playerTags;
    if (!tags.length) {
      this.logger.debug('No legend player tags found in Redis.');
      return { message: 'Ok' };
    }

    this.logger.log(`Updating battle logs for ${tags.length} legend players.`);

    const BATCH_SIZE = 100;
    let updated = 0;
    let skipped = 0;

    try {
      for (let i = 0; i < tags.length; i += BATCH_SIZE) {
        const batch = tags.slice(i, i + BATCH_SIZE);
        const values = await this.redis.mget(...batch.map((tag) => `LEGEND:${tag}`));

        const players = batch
          .map((tag, idx) => {
            const raw = values[idx];
            if (!raw) return null;
            try {
              const data = JSON.parse(raw) as { name?: string };
              return data.name ? { tag, name: data.name } : null;
            } catch {
              return null;
            }
          })
          .filter((p): p is { tag: string; name: string } => p !== null);

        skipped += batch.length - players.length;
        updated += players.length;

        this.logger.debug(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${players.length} players to update, ${batch.length - players.length} skipped (no Redis data).`,
        );

        if (players.length) {
          await this.clickhouse.query({
            query: `
            ALTER TABLE battle_logs
            UPDATE player_name = arrayElement({names: Array(String)}, indexOf({tags: Array(String)}, player_tag))
            WHERE player_tag IN {tags: Array(String)} AND player_name = 'Unknown'
          `,
            query_params: {
              tags: players.map((p) => p.tag),
              names: players.map((p) => p.name),
            },
          });
        }
      }
    } catch (error) {
      this.logger.error(error);
    }

    this.logger.log(`Done. Updated: ${updated}, skipped: ${skipped}.`);
    return { message: 'Ok' };
  }
}
