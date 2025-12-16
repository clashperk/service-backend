import { getPreviousBestAttack } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import moment from 'moment';
import { Db } from 'mongodb';
import { ClanWarsEntity, Collections, MONGODB_TOKEN } from '../../db';
import {
  AggregateAttackHistoryDto,
  AggregateAttackHistoryItemsDto,
  AttackHistoryDto,
  WarTypes,
} from '../dto';

@Injectable()
export class PlayerWarsService {
  constructor(@Inject(MONGODB_TOKEN) private db: Db) {}

  async getAttackHistory(input: { playerTag: string; startDate: number; cwlOnly?: boolean }) {
    const cursor = this.wars.aggregate<ClanWarsEntity>([
      {
        $match: {
          $or: [
            { 'clan.members.tag': input.playerTag },
            { 'opponent.members.tag': input.playerTag },
          ],
          startTime: {
            $gte: moment(input.startDate).toDate(),
          },
          ...(input.cwlOnly ? { warType: WarTypes.CWL } : {}),
        },
      },
      { $sort: { _id: -1 } },
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

  async aggregateClanWarLeagueHistory(input: { playerTag: string; startDate: number }) {
    const { playerTag, startDate } = input;
    const cursor = this.wars.aggregate([
      {
        $match: {
          $or: [{ 'clan.members.tag': playerTag }, { 'opponent.members.tag': playerTag }],
          startTime: {
            $gte: moment(startDate).toDate(),
          },
        },
      },
      { $sort: { _id: -1 } },
      {
        $group: {
          _id: '$leagueGroupId',
          leagueGroupId: { $first: '$leagueGroupId' },
          season: { $first: '$season' },
        },
      },
      {
        $lookup: {
          from: Collections.CLAN_WARS,
          localField: 'leagueGroupId',
          foreignField: 'leagueGroupId',
          as: 'wars',
          pipeline: [
            {
              $match: {
                $or: [{ 'clan.members.tag': playerTag }, { 'opponent.members.tag': playerTag }],
                endTime: { $lte: moment().toDate() },
              },
            },
            {
              $project: {
                members: {
                  $filter: {
                    input: { $concatArrays: ['$opponent.members', '$clan.members'] },
                    as: 'member',
                    cond: { $eq: ['$$member.tag', playerTag] },
                  },
                },
              },
            },
            { $sort: { _id: -1 } },
            { $unwind: '$members' },
            {
              $set: {
                stars: {
                  $sum: { $max: ['$members.attacks.stars', 0] },
                },
                destruction: {
                  $sum: { $max: ['$members.attacks.destructionPercentage', 0] },
                },
                attacks: {
                  $sum: { $cond: [{ $eq: ['$members.attacks.stars', 0] }, 0, 1] },
                },
                missed: {
                  $sum: { $cond: [{ $anyElementTrue: [['$members.attacks']] }, 0, 1] },
                },
              },
            },
          ],
        },
      },
      {
        $set: {
          totalWars: { $size: '$wars' },
          totalStars: { $sum: '$wars.stars' },
          totalAttacks: { $sum: '$wars.attacks' },
          totalMissed: { $sum: '$wars.missed' },
          totalDestruction: { $sum: '$wars.destruction' },
        },
      },
      {
        $lookup: {
          from: Collections.CWL_GROUPS,
          localField: 'leagueGroupId',
          foreignField: 'id',
          as: 'leagueGroup',
          pipeline: [
            {
              $project: { rounds: { $subtract: [{ $size: '$clans' }, 1] } },
            },
          ],
        },
      },
      { $unwind: { path: '$leagueGroup' } },
      {
        $project: {
          _id: 0,
          season: 1,
          totalAttacks: 1,
          totalMissed: 1,
          totalDestruction: 1,
          totalStars: 1,
          totalWars: 1,
          rounds: '$leagueGroup.rounds',
        },
      },
      { $sort: { season: -1 } },
    ]);

    const result = await cursor.toArray();
    return result;
  }

  private get wars() {
    return this.db.collection(Collections.CLAN_WARS);
  }
}
