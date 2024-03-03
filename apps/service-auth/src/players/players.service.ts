import { Collections } from '@app/constants';
import { ClanWarsEntity } from '@app/entities';
import { Inject, Injectable } from '@nestjs/common';
import moment from 'moment';
import { Collection } from 'mongodb';
import { AttackHistoryAggregated, AttackHistoryOutput } from './dto/attack-history-output.dto';
import { CWLAttackSummaryOutput } from './dto/attack-summary-output.dto';

@Injectable()
export class PlayersService {
  constructor(
    @Inject(Collections.CLAN_WARS)
    private clanWarsCollection: Collection<ClanWarsEntity>,
  ) {}

  async getClanWarHistory(playerTag: string, months: number) {
    const cursor = this.clanWarsCollection.aggregate<AttackHistoryAggregated>([
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
        $set: {
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
        $set: {
          defenderTags: {
            $arrayElemAt: ['$members.attacks.defenderTag', 0],
          },
        },
      },
      {
        $set: {
          defenders: {
            $filter: {
              input: {
                $concatArrays: ['$opponent.members', '$clan.members'],
              },
              as: 'member',
              cond: {
                $in: [
                  '$$member.tag',
                  {
                    $cond: [{ $anyElementTrue: [['$defenderTags']] }, '$defenderTags', []],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          id: 1,
          warType: 1,
          startTime: '$preparationStartTime',
          endTime: '$preparationStartTime',
          clan: {
            $cond: [
              {
                $in: [playerTag, '$clan.members.tag'],
              },
              {
                name: '$clan.name',
                tag: '$clan.tag',
              },
              {
                name: '$opponent.name',
                tag: '$opponent.tag',
              },
            ],
          },
          opponent: {
            $cond: [
              {
                $in: [playerTag, '$clan.members.tag'],
              },
              {
                name: '$opponent.name',
                tag: '$opponent.tag',
              },
              {
                name: '$clan.name',
                tag: '$clan.tag',
              },
            ],
          },
          members: {
            tag: 1,
            name: 1,
            townhallLevel: 1,
            mapPosition: 1,
            attacks: {
              stars: 1,
              defenderTag: 1,
              destructionPercentage: 1,
            },
          },
          defenders: {
            tag: 1,
            townhallLevel: 1,
            mapPosition: 1,
          },
        },
      },
    ]);

    const history = await cursor.toArray();

    const wars: AttackHistoryOutput[] = [];
    for (const war of history) {
      const attacker = war.members.at(0)!;
      const attacks = (attacker.attacks ?? []).map((attack) => {
        const defender =
          war.defenders.find((defender) => defender.tag === attack.defenderTag) ?? null;
        return { ...attack, defender };
      });

      wars.push({
        id: war.id,
        warType: war.warType,
        startTime: war.startTime,
        endTime: war.endTime,
        clan: war.clan,
        opponent: war.opponent,
        attacker: {
          name: attacker.name,
          tag: attacker.tag,
          townhallLevel: attacker.townhallLevel,
          mapPosition: attacker.mapPosition,
        },
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
}
