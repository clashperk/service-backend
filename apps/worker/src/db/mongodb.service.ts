import { Inject } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from './mongodb.module';

export class MongoService {
  constructor(@Inject(MONGODB_TOKEN) private db: Db) {}

  async disableClan(clanTag: string) {
    return this.db
      .collection(Collections.CLAN_STORES)
      .updateMany({ tag: clanTag }, { $set: { paused: true, deleted: true } });
  }
}
