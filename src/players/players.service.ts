import { ClashClient } from '@app/clash-client';
import { Collections, Tokens } from '@app/constants';
import { ClanWarsEntity } from '@app/entities';
import { LegendAttacksEntity } from '@app/entities/legend-attacks.entity';
import { getPreviousBestAttack } from '@app/helper';
import { Inject, Injectable } from '@nestjs/common';
import moment from 'moment';
import { Collection } from 'mongodb';
import { AttackHistoryOutput, CWLAttackSummaryOutput } from './dto';

@Injectable()
export class PlayersService {
  constructor(
    @Inject(Collections.CLAN_WARS)
    private clanWarsCollection: Collection<ClanWarsEntity>,
    @Inject(Collections.LEGEND_ATTACKS)
    private legendAttacks: Collection<LegendAttacksEntity>,
    @Inject(Tokens.CLASH_CLIENT) private clashClient: ClashClient,
  ) {}

  async getClanWarHistory(playerTag: string, months: number) {
    const cursor = this.clanWarsCollection.aggregate<ClanWarsEntity>([
      {
        $match: {
          $or: [{ 'clan.members.tag': playerTag }, { 'opponent.members.tag': playerTag }],
          preparationStartTime: {
            $gte: moment().startOf('month').subtract(months, 'month').toDate(),
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

    const wars: AttackHistoryOutput[] = [];

    for await (const war of cursor) {
      const isPlayerInClan = war.clan.members.find((mem) => mem.tag === playerTag);
      const clan = isPlayerInClan ? war.clan : war.opponent;
      const opponent = isPlayerInClan ? war.opponent : war.clan;

      clan.members.sort((a, b) => a.mapPosition - b.mapPosition);
      opponent.members.sort((a, b) => a.mapPosition - b.mapPosition);

      const __attacks = clan.members.map((mem) => mem.attacks ?? []).flat();
      const attacker = clan.members.find((mem) => mem.tag === playerTag)!;

      const attacks = (attacker.attacks ?? []).map((atk) => {
        const previousBestAttack = getPreviousBestAttack(__attacks, opponent, atk);
        const defender = opponent.members.find((mem) => mem.tag === atk.defenderTag)!;

        return {
          ...atk,
          newStars: previousBestAttack
            ? Math.max(0, atk.stars - previousBestAttack.stars)
            : atk.stars,
          oldStars: previousBestAttack?.stars ?? 0,
          defender,
        };
      });

      wars.push({
        id: war.id,
        clan,
        opponent,
        endTime: war.endTime,
        startTime: war.startTime,
        warType: war.warType,
        attacker,
        attacks,
      });
    }

    return wars;
  }

  async getCWLAttackSummary(playerTag: string, months: number) {
    const cursor = this.clanWarsCollection.aggregate<CWLAttackSummaryOutput>([
      {
        $match: {
          $or: [
            {
              'clan.members.tag': playerTag,
            },
            {
              'opponent.members.tag': playerTag,
            },
          ],
          preparationStartTime: {
            $gte: moment().startOf('month').subtract(months, 'month').toDate(),
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
      {
        $group: {
          _id: '$leagueGroupId',
          leagueGroupId: {
            $first: '$leagueGroupId',
          },
          season: {
            $first: '$season',
          },
        },
      },
      {
        $lookup: {
          from: 'ClanWars',
          localField: 'leagueGroupId',
          foreignField: 'leagueGroupId',
          as: 'wars',
          pipeline: [
            {
              $match: {
                $or: [
                  {
                    'clan.members.tag': playerTag,
                  },
                  {
                    'opponent.members.tag': playerTag,
                  },
                ],
                endTime: {
                  $lte: moment().toDate(),
                },
              },
            },
            {
              $project: {
                members: {
                  $filter: {
                    input: {
                      $concatArrays: ['$opponent.members', '$clan.members'],
                    },
                    as: 'member',
                    cond: {
                      $eq: ['$$member.tag', playerTag],
                    },
                  },
                },
              },
            },
            {
              $sort: {
                _id: -1,
              },
            },
            {
              $unwind: '$members',
            },
            {
              $set: {
                stars: {
                  $sum: {
                    $max: ['$members.attacks.stars', 0],
                  },
                },
                destruction: {
                  $sum: {
                    $max: ['$members.attacks.destructionPercentage', 0],
                  },
                },
                attacks: {
                  $sum: {
                    $cond: [{ $eq: ['$members.attacks.stars', 0] }, 0, 1],
                  },
                },
                missed: {
                  $sum: {
                    $cond: [
                      {
                        $anyElementTrue: [['$members.attacks']],
                      },
                      0,
                      1,
                    ],
                  },
                },
              },
            },
          ],
        },
      },
      {
        $set: {
          wars: {
            $size: '$wars',
          },
          stars: {
            $sum: '$wars.stars',
          },
          attacks: {
            $sum: '$wars.attacks',
          },
          missed: {
            $sum: '$wars.missed',
          },
          destruction: {
            $sum: '$wars.destruction',
          },
        },
      },
      {
        $lookup: {
          from: 'CWLGroups',
          localField: 'leagueGroupId',
          foreignField: 'id',
          as: 'leagueGroup',
          pipeline: [
            {
              $project: {
                rounds: {
                  $subtract: [
                    {
                      $size: '$clans',
                    },
                    1,
                  ],
                },
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$leagueGroup',
        },
      },
      {
        $project: {
          attacks: 1,
          season: 1,
          wars: 1,
          stars: 1,
          missed: 1,
          destruction: 1,
          rounds: '$leagueGroup.rounds',
        },
      },
      {
        $sort: {
          season: -1,
        },
      },
    ]);

    const result: CWLAttackSummaryOutput[] = await cursor.toArray();

    return result;
  }

  async getLegendAttacks(playerTags: string[]) {
    const result = await this.legendAttacks
      .find(
        { tag: { $in: playerTags }, seasonId: this.clashClient.util.getSeasonId() },
        { projection: { _id: 0, defenseLogs: 0, attackLogs: 0, streak: 0 } },
      )
      .toArray();

    return result;
  }
}
