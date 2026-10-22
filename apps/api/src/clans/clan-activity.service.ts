import { ClashClientService } from '@app/clash-client';
import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { CLICKHOUSE_TOKEN, Collections, GLOBAL_MONGODB_TOKEN, MONGODB_TOKEN } from '../db';
import { ClanActivityDto, ClanActivityInputDto, ClanActivityType } from './dto';

interface ActivityRow {
  type: ClanActivityType;
  playerTag: string;
  playerName: string;
  clanTag: string;
  clanName: string;
  value: string;
  createdAt: string;
}

const LEAGUE_TYPES = new Set<ClanActivityType>(['war_league_change', 'capital_league_change']);

@Injectable()
export class ClanActivityService {
  constructor(
    @Inject(CLICKHOUSE_TOKEN) private clickhouse: ClickHouseClient,
    @Inject(MONGODB_TOKEN) private db: Db,
    @Inject(GLOBAL_MONGODB_TOKEN) private globalDb: Db,
    private clashClientService: ClashClientService,
  ) {}

  /** Town Hall upgrades, joins and leaves, and clan milestones, newest first. */
  async getActivity({
    clanTags,
    days,
    limit,
    types,
  }: ClanActivityInputDto): Promise<ClanActivityDto> {
    const result = await this.clickhouse.query({
      query: `
        SELECT * FROM (
          SELECT 'town_hall_upgrade' AS type, tag AS playerTag, name AS playerName,
            clanTag, clanName, value, createdAt
          FROM clan_member_event_logs
          WHERE clanTag IN {clanTags:Array(String)} AND op = 'TOWN_HALL_UPGRADE'
            AND createdAt > now() - toIntervalDay({days:UInt8})
          UNION ALL
          SELECT lower(op) AS type, '' AS playerTag, '' AS playerName,
            tag AS clanTag, name AS clanName, value, createdAt
          FROM clan_event_logs
          WHERE tag IN {clanTags:Array(String)}
            AND op IN ('CLAN_LEVEL_UP', 'CAPITAL_HALL_LEVEL_UP', 'WAR_LEAGUE_CHANGE', 'CAPITAL_LEAGUE_CHANGE')
            AND createdAt > now() - toIntervalDay({days:UInt8})
          UNION ALL
          SELECT if(action = 'JOINED_CLAN', 'joined', 'left') AS type, tag AS playerTag, '' AS playerName,
            clanTag, '' AS clanName, toInt64(0) AS value, createdAt
          FROM clan_join_leave_logs
          WHERE clanTag IN {clanTags:Array(String)}
            AND createdAt > now() - toIntervalDay({days:UInt8})
        )
        WHERE type IN {types:Array(String)}
        ORDER BY createdAt DESC
        LIMIT {limit:UInt16}
      `,
      query_params: { clanTags, days, limit, types },
      format: 'JSONEachRow',
    });
    const rows = await result.json<ActivityRow>();

    // Joins and leaves carry no names in ClickHouse; fill them from the stores.
    const [playerNames, clanNames, leagueNames] = await Promise.all([
      this.playerNames(
        rows.filter((row) => !row.playerName && row.playerTag).map((row) => row.playerTag),
      ),
      this.clanNames(rows.filter((row) => !row.clanName).map((row) => row.clanTag)),
      rows.some((row) => LEAGUE_TYPES.has(row.type))
        ? this.clashClientService.getLeagueNames().catch(() => new Map<number, string>())
        : new Map<number, string>(),
    ]);

    return {
      items: rows.map((row) => {
        const value = Number(row.value);
        const league = LEAGUE_TYPES.has(row.type);
        return {
          type: row.type,
          // ClickHouse DateTime is UTC without a zone marker.
          createdAt: new Date(`${row.createdAt.replace(' ', 'T')}Z`),
          clan: {
            tag: row.clanTag,
            name: row.clanName || clanNames.get(row.clanTag) || row.clanTag,
          },
          player: row.playerTag
            ? {
                tag: row.playerTag,
                name: row.playerName || playerNames.get(row.playerTag) || row.playerTag,
              }
            : null,
          level: league || !value ? null : value,
          league: league ? (leagueNames.get(value) ?? null) : null,
        };
      }),
    };
  }

  private async playerNames(tags: string[]) {
    if (!tags.length) return new Map<string, string>();
    const players = await this.db
      .collection(Collections.PLAYERS)
      .find({ tag: { $in: [...new Set(tags)] } }, { projection: { tag: 1, name: 1 } })
      .toArray();
    return new Map(players.map((player) => [player.tag, player.name]));
  }

  private async clanNames(tags: string[]) {
    if (!tags.length) return new Map<string, string>();
    const clans = await this.globalDb
      .collection(Collections.GLOBAL_CLANS)
      .find({ tag: { $in: [...new Set(tags)] } }, { projection: { tag: 1, name: 1 } })
      .toArray();
    return new Map(clans.map((clan) => [clan.tag, clan.name]));
  }
}
