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
          opponent_tag as opponentTag,
          battle_type as battleType,
          toBool(is_attack) as isAttack,
          stars,
          destruction,
          trophies,
          league_id as leagueId,
          trophy_change as trophyChange,
          battle_date as battleDate,
          battle_season as battleSeason,
          battle_week as battleWeek,
          ingested_at as ingestedAt
        FROM battle_logs FINAL
        WHERE player_tag = {playerTag: String}
        ORDER BY version
        LIMIT {limit: Int32}
      `,
      query_params: {
        playerTag,
        limit: 8 * 2 * 28,
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
          player_tag as tag,
          argMin(player_name, version) AS name,
          battle_date AS battleDate,
          argMin(trophies, version) AS trophies,
          countIf(is_attack = 1) AS attackCount,
          countIf(is_attack = 0) AS defenseCount,
          sumIf(trophy_change, is_attack = 1) AS offenseTrophies,
          sumIf(trophy_change, is_attack = 0) AS defenseTrophies,
          sum(trophy_change) AS gain
        FROM battle_logs FINAL
        WHERE player_tag = {playerTag: String}
        GROUP BY battleDate, tag
        ORDER BY battleDate ASC
        LIMIT {limit: Int32}
      `,
      query_params: { playerTag, limit: 8 * 2 * 28 * 2 },
    });

    const rows = await result.json<BattleLogDailyDto>();
    return {
      items: (rows.data || []).map((row) => ({
        ...row,
        trophies: Number(row.trophies),
        offenseTrophies: Number(row.offenseTrophies),
        defenseTrophies: Number(row.defenseTrophies),
        attackCount: Number(row.attackCount),
        defenseCount: Number(row.defenseCount),
        gain: Number(row.gain),
      })),
    };
  }

  async getBattleLogLeaderboard({
    playerTags,
    seasonId,
  }: BattleLogLeaderboardInputDto): Promise<BattleLogLeaderboardDto> {
    const results = await Promise.all(
      chunk(playerTags, 200).map((chunk) =>
        this.clickhouse
          .query({
            query: `
              SELECT
                player_tag AS tag,
                player_name AS name,
                trophies
              FROM legend_players_projected FINAL
              WHERE player_tag IN {playerTags: Array(String)}
                AND battle_season = {seasonId: String}
              ORDER BY trophies DESC
            `,
            query_params: { playerTags: chunk, seasonId },
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
}
