import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections } from '../db/db.constants';
import { MONGODB_TOKEN } from '../db/mongodb.module';

@Injectable()
export class LinksService {
  constructor(@Inject(MONGODB_TOKEN) private db: Db) {}

  public async getLinksByUserIds(userIds: string[]) {
    return this.links
      .find({ userId: { $in: userIds } }, { projection: this.projection })
      .sort({ order: 1 })
      .toArray();
  }

  public async getLinksByPlayerTags(playerTags: string[]) {
    return this.links
      .find({ tag: { $in: playerTags } }, { projection: this.projection })
      .sort({ order: 1 })
      .toArray();
  }

  private get projection() {
    return { _id: 0, tag: 1, name: 1, userId: 1, username: 1, order: 1, verified: 1 };
  }

  private get links() {
    return this.db.collection(Collections.PLAYER_LINKS);
  }
}
