import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { CLICKHOUSE_TOKEN, Collections, MONGODB_TOKEN } from '../db';

@Injectable()
export class ClanMembersService {
  constructor(
    @Inject(MONGODB_TOKEN) private db: Db,
    @Inject(CLICKHOUSE_TOKEN) private clickhouse: ClickHouseClient,
  ) {}

  public async getLastSeen(playerTags: string[]) {
    const [players, scores] = await Promise.all([
      this.db
        .collection(Collections.PLAYERS)
        .find(
          { tag: { $in: playerTags } },
          {
            projection: {
              _id: 0,
              name: 1,
              tag: 1,
              clan: 1,
              lastSeen: 1,
              leagueId: 1,
              townHallLevel: 1,
            },
          },
        )
        .toArray(),
      this.getActivityScores(playerTags),
    ]);

    return players.map((player) => {
      return {
        ...player,
        scores: scores[player.tag],
      };
    });
  }

  private async getActivityScores(playerTags: string[]) {
    const rows = await this.clickhouse
      .query({
        query: `
          SELECT
            tag,
            countIf(createdAt >= now() - INTERVAL 1 DAY)  AS count_last_24h,
            countIf(createdAt >= now() - INTERVAL 30 DAY) AS count_last_30d,
            max(createdAt)                                AS last_seen_at
          FROM player_activities
          WHERE
            tag in {tags: Array(String)}
            AND createdAt >= {createdAt: DateTime}
          GROUP BY tag
        `,
        query_params: {
          tags: playerTags,
          createdAt: Math.floor(new Date().getTime() / 1000) - 30 * 24 * 60 * 60,
        },
      })
      .then((res) => res.json<AggregatedActivityScoreRaw>());

    const result = (rows.data ?? []).reduce<Record<string, AggregatedActivityScore>>(
      (record, row) => {
        record[row.tag] = {
          last24h: Number(row.count_last_24h),
          last30d: Number(row.count_last_30d),
        };
        return record;
      },
      {},
    );

    return result;
  }
}

export interface AggregatedActivityScoreRaw {
  tag: string;
  count_last_24h: number;
  count_last_30d: number;
  last_seen_at: string;
}

export interface AggregatedActivityScore {
  last24h: number;
  last30d: number;
}
