import { Inject } from '@nestjs/common';
import { Util } from 'clashofclans.js';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../../db';

export class ClanGamesTasksService {
  constructor(@Inject(MONGODB_TOKEN) private readonly db: Db) {}

  async runClanGamesTask() {
    const seasonId = Util.getSeasonId();
    await this.games.updateMany({ season: seasonId }, { $set: { season: `${seasonId}-00` } });
  }

  private get games() {
    return this.db.collection(Collections.CLAN_GAMES_POINTS);
  }
}
