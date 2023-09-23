import { Collections, Tokens } from '@app/constants';
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
  ) {}

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
}

export interface TrackActivityInput {
  name: string;
  tag: string;
  clan: {
    name: string;
    tag: string;
  };
}
