import { getPreviousBestAttack } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import moment from 'moment';
import { Db } from 'mongodb';
import { ClanWarsEntity, Collections, MONGODB_TOKEN } from '../db';
import { AggregateAttackHistoryDto, AttackHistoryDto } from './dto';

@Injectable()
export class PlayersService {
  constructor(@Inject(MONGODB_TOKEN) private db: Db) {}

  async getAttackHistory(input: { playerTag: string; startDate: number }) {
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
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
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
          destructionPercentage: atk.destructionPercentage,
          defender: {
            tag: atk.defender.tag,
            townHallLevel: atk.defender.townhallLevel,
            mapPosition: atk.defender.mapPosition,
          },
        })),
      });
    }

    return wars;
  }

  async aggregateAttackHistory(input: {
    playerTag: string;
    startDate: number;
  }): Promise<AggregateAttackHistoryDto> {
    const logs = await this.getAttackHistory(input);

    const result: AggregateAttackHistoryDto = {
      totalWars: 0,
      totalAttacks: 0,
      total3Stars: 0,
      totalMissed: 0,
      totalStars: 0,
    };

    for (const log of logs) {
      result.totalWars += 1;
      result.totalAttacks += log.attacks.length;
      result.total3Stars += log.attacks.filter((atk) => atk.stars === 3).length;
      result.totalStars += log.attacks.reduce((acc, atk) => acc + atk.trueStars, 0);
      result.totalMissed += log.attacksPerMember - log.attacks.length;
    }

    return result;
  }

  private get wars() {
    return this.db.collection(Collections.CLAN_WARS);
  }
}
