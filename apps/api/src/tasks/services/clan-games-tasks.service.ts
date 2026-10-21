import { Season } from '@app/clash-client';
import { Inject } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../../db';

export class ClanGamesTasksService {
  constructor(@Inject(MONGODB_TOKEN) private readonly db: Db) {}

  async runClanGamesTask() {
    // Clan games points are stored per calendar month, not per league season.
    const seasonId = Season.monthId;
    await this.games.updateMany({ season: seasonId }, { $set: { season: `${seasonId}-00` } });
  }

  private get games() {
    return this.db.collection(Collections.CLAN_GAMES_POINTS);
  }
}
