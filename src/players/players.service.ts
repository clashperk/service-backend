import { getPreviousBestAttack } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import moment from 'moment';
import { Db } from 'mongodb';
import { ClanWarsEntity, Collections, MONGODB_TOKEN } from '../db';
import { AttackHistoryDto } from './dto';

@Injectable()
export class PlayersService {
  constructor(@Inject(MONGODB_TOKEN) private db: Db) {}

  async clanWarAttackLog(input: { playerTag: string; months: number }) {
    const cursor = this.wars.aggregate<ClanWarsEntity>([
      {
        $match: {
          $or: [
            { 'clan.members.tag': input.playerTag },
            { 'opponent.members.tag': input.playerTag },
          ],
          startTime: {
            $gte: moment().startOf('month').subtract(input.months, 'month').toDate(),
          },
          endTime: {
            $lte: moment().toDate(),
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

  private get wars() {
    return this.db.collection(Collections.CLAN_WARS);
  }
}
