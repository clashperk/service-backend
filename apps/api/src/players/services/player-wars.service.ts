import { getPreviousBestAttack } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import moment from 'moment';
import { Db } from 'mongodb';
import { ClanWarsEntity, Collections, MONGODB_TOKEN } from '../../db';
import {
  AggregateAttackHistoryDto,
  AggregateAttackHistoryItemsDto,
  AggregateClanWarLeagueHistoryDto,
  AggregateClanWarLeagueHistoryItemsDto,
  AttackHistoryDto,
  WarTypes,
} from '../dto';

type CwlSide = Pick<ClanWarsEntity['clan'], 'tag' | 'name' | 'members'>;
type CwlRound = Pick<
  ClanWarsEntity,
  'season' | 'leagueGroupId' | 'endTime' | 'attacksPerMember'
> & {
  clan: CwlSide;
  opponent: CwlSide;
};

@Injectable()
export class PlayerWarsService {
  constructor(@Inject(MONGODB_TOKEN) private db: Db) {}

  async getAttackHistory(input: {
    playerTag: string;
    startDate?: number;
    limit?: number;
    cwlOnly?: boolean;
  }) {
    const cursor = this.wars.aggregate<ClanWarsEntity>([
      {
        $match: {
          $or: [
            { 'clan.members.tag': input.playerTag },
            { 'opponent.members.tag': input.playerTag },
          ],
          ...(input.startDate ? { startTime: { $gte: moment(input.startDate).toDate() } } : {}),
          ...(input.cwlOnly ? { warType: WarTypes.CWL } : {}),
        },
      },
      { $sort: { startTime: -1 } },
      ...(input.limit ? [{ $limit: input.limit }] : []),
    ]);

    const wars: AttackHistoryDto[] = [];

    for await (const war of cursor) {
      const isPlayerInClan = war.clan.members.find((mem) => mem.tag === input.playerTag);
      const clan = isPlayerInClan ? war.clan : war.opponent;
      const opponent = isPlayerInClan ? war.opponent : war.clan;

      clan.members.sort((a, b) => a.mapPosition - b.mapPosition);
      opponent.members.sort((a, b) => a.mapPosition - b.mapPosition);

      const attackList = clan.members.map((mem) => mem.attacks ?? []).flat();
      const attacker = clan.members.find((mem) => mem.tag === input.playerTag)!;

      const attacks = (attacker.attacks ?? []).map((atk) => {
        const previousBestAttack = getPreviousBestAttack(attackList, atk);
        const defender = opponent.members.find((mem) => mem.tag === atk.defenderTag)!;

        return {
          ...atk,
          trueStars: previousBestAttack
            ? Math.max(0, atk.stars - previousBestAttack.stars)
            : atk.stars,
          defender,
        };
      });

      wars.push({
        season: war.season,
        id: war.id,
        clan: {
          name: clan.name,
          tag: clan.tag,
        },
        opponent: {
          name: opponent.name,
          tag: opponent.tag,
        },
        endTime: war.endTime,
        startTime: war.startTime,
        warType: war.warType,
        attacksPerMember: war.attacksPerMember || 1,
        teamSize: war.teamSize,
        attacker: {
          name: attacker.name,
          tag: attacker.tag,
          townHallLevel: attacker.townhallLevel,
          mapPosition: attacker.mapPosition,
        },
        attacks: attacks.map((atk) => ({
          stars: atk.stars,
          trueStars: atk.trueStars,
          defenderTag: atk.defenderTag,
          destruction: atk.destructionPercentage,
          defender: {
            tag: atk.defender.tag,
            townHallLevel: atk.defender.townhallLevel,
            mapPosition: atk.defender.mapPosition,
          },
        })),
      });
    }

    return { items: wars };
  }

  async aggregateAttackHistory(input: {
    playerTag: string;
    startDate: number;
  }): Promise<AggregateAttackHistoryItemsDto> {
    const logs = await this.getAttackHistory(input);

    const aggregated = logs.items.reduce<Record<string, AggregateAttackHistoryDto>>(
      (record, log) => {
        const result = record[log.season] || {
          totalWars: 0,
          totalAttacks: 0,
          total3Stars: 0,
          totalMissed: 0,
          totalStars: 0,
          season: log.season,
        };

        result.totalWars += 1;
        result.totalAttacks += log.attacks.length;
        result.total3Stars += log.attacks.filter((atk) => atk.stars === 3).length;
        result.totalStars += log.attacks.reduce((acc, atk) => acc + atk.trueStars, 0);
        result.totalMissed += log.attacksPerMember - log.attacks.length;

        record[log.season] = result;

        return record;
      },
      {},
    );

    return { items: Object.values(aggregated) };
  }

  /** The player's CWL rounds per league group, newest first, with the clan's league in it. */
  async aggregateClanWarLeagueHistory(input: {
    playerTag: string;
    startDate: number;
  }): Promise<AggregateClanWarLeagueHistoryItemsDto> {
    const { playerTag } = input;
    const ownSide = (side: '$clan' | '$opponent') => ({
      tag: `${side}.tag`,
      name: `${side}.name`,
      members: { $filter: { input: `${side}.members`, cond: { $eq: ['$$this.tag', playerTag] } } },
    });
    const wars = await this.wars
      .aggregate<CwlRound>([
        {
          $match: {
            $or: [{ 'clan.members.tag': playerTag }, { 'opponent.members.tag': playerTag }],
            warType: WarTypes.CWL,
            startTime: { $gte: moment(input.startDate).toDate() },
          },
        },
        { $sort: { startTime: -1 } },
        {
          $project: {
            _id: 0,
            season: 1,
            leagueGroupId: 1,
            endTime: 1,
            attacksPerMember: 1,
            clan: ownSide('$clan'),
            opponent: ownSide('$opponent'),
          },
        },
      ])
      .toArray();

    const rows = new Map<string, AggregateClanWarLeagueHistoryDto & { groupId: number | null }>();
    for (const war of wars) {
      const side = war.clan.members.length ? war.clan : war.opponent;
      const key = war.leagueGroupId ?? `${war.season}:${side.tag}`;
      const row = rows.get(String(key)) ?? {
        season: war.season,
        clan: { tag: side.tag, name: side.name },
        leagueId: null,
        groupId: war.leagueGroupId,
        wars: 0,
        attacks: 0,
        missed: 0,
        stars: 0,
        threeStars: 0,
        destruction: 0,
      };
      const attacks = side.members[0].attacks ?? [];
      row.wars += 1;
      if (war.endTime.getTime() <= Date.now()) {
        row.missed += Math.max(0, (war.attacksPerMember || 1) - attacks.length);
      }
      for (const attack of attacks) {
        row.attacks += 1;
        row.stars += attack.stars;
        row.destruction += attack.destructionPercentage;
        if (attack.stars === 3) row.threeStars += 1;
      }
      rows.set(String(key), row);
    }

    const groupIds = [...rows.values()].flatMap((row) => row.groupId ?? []);
    const groups = await this.db
      .collection(Collections.CWL_GROUPS)
      .find({ id: { $in: groupIds } }, { projection: { _id: 0, id: 1, clans: 1 } })
      .toArray();

    return {
      items: [...rows.values()].map(({ groupId, ...row }) => ({
        ...row,
        leagueId:
          groups
            .find((group) => group.id === groupId)
            ?.clans.find((clan) => clan.tag === row.clan.tag)?.leagueId ?? null,
      })),
    };
  }

  private get wars() {
    return this.db.collection(Collections.CLAN_WARS);
  }
}
