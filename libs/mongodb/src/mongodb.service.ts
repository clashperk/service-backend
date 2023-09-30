import { Collections, Tokens } from '@app/constants';
import { ClanStoresEntity } from '@app/entities';
import { LastSeenEntity } from '@app/entities/users.entity';
import { Inject, Injectable } from '@nestjs/common';
import { Util } from 'clashofclans.js';
import moment from 'moment';
import { Collection, Db } from 'mongodb';

@Injectable()
export class MongodbService {
  constructor(
    @Inject(Tokens.MONGODB) private readonly db: Db,

    @Inject(Collections.LAST_SEEN)
    private readonly lastSeenCollection: Collection<LastSeenEntity>,
    @Inject(Collections.CLAN_STORES)
    private readonly clanStoresCollection: Collection<ClanStoresEntity>,
  ) {}

  async getTrackedClans() {
    const result = await this.clanStoresCollection
      .aggregate<TrackedClanList>([
        {
          $match: {
            paused: false,
          },
        },
        {
          $group: {
            _id: '$tag',
            patron: {
              $addToSet: '$patron',
            },
            uniqueId: {
              $max: '$uniqueId',
            },
            flags: {
              $addToSet: '$flag',
            },
            lastRan: {
              $max: '$lastRan',
            },
            guildIds: {
              $addToSet: '$guild',
            },
          },
        },
        {
          $set: {
            tag: '$_id',
            mod: {
              $mod: ['$uniqueId', 1],
            },
            isPatron: {
              $in: [true, '$patron'],
            },
          },
        },
      ])
      .toArray();

    return result;
  }

  async trackActivity(players: TrackActivityInput[]) {
    const currentTime = moment().minutes(0).seconds(0).milliseconds(0).toDate();
    const seasonId = Util.getSeasonId();

    for (const player of players) {
      const $set = {
        name: player.name,
        clan: {
          tag: player.clan.tag,
          name: player.clan.name,
        },
        lastSeen: new Date(),
      };

      const updated = await this.lastSeenCollection.updateOne(
        { tag: player.tag, 'entries.entry': new Date(currentTime) },
        {
          $set,
          $inc: { 'entries.$.count': 1, [`seasons.${seasonId}`]: 1 },
        },
      );

      if (updated.modifiedCount === 0) {
        await this.lastSeenCollection.updateOne(
          { tag: player.tag },
          {
            $set,
            $inc: { [`seasons.${seasonId}`]: 1 },
            $addToSet: { entries: { entry: new Date(currentTime), count: 1 } },
          },
          { upsert: true },
        );
      }
    }
  }

  private bitWiseOr(flags: number[]) {
    return flags.reduce((acc, curr) => acc | curr, 0);
  }
}

export interface TrackedClanList {
  tag: string;
  isPatron: boolean;
  guildIds: string[];
}

export interface TrackActivityInput {
  name: string;
  tag: string;
  clan: {
    name: string;
    tag: string;
  };
}
