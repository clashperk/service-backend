import { APIPlayerTransformed } from '@app/helpers/types';
import { Inject, Injectable } from '@nestjs/common';
import { APICapitalRaidSeason, APIClan } from 'clashofclans.js';
import Redis from 'ioredis';
import { REDIS_TOKEN } from './redis.module';

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_TOKEN) private redis: Redis) {}

  public async getClan(clanTag: string) {
    const key = `CLAN:${clanTag}`;
    return this.toJSON<APIClan>(await this.redis.get(key));
  }

  public async setClan(clan: APIClan) {
    const key = `CLAN:${clan.tag}`;
    return this.redis.set(key, JSON.stringify(clan), 'EX', 6 * 60 * 60);
  }

  public async getPlayer(playerTag: string) {
    const key = `PLAYER:${playerTag}`;
    return this.toJSON<APIPlayerTransformed>(await this.redis.get(key));
  }

  public async setPlayer(player: APIPlayerTransformed) {
    const key = `PLAYER:${player.tag}`;
    return this.redis.set(key, JSON.stringify(player), 'EX', 60 * 60 * 24 * 45);
  }

  public async getRaidSeason(clanTag: string) {
    const key = `RAID_SEASON:${clanTag}`;
    return this.toJSON<RaidSeason>(await this.redis.get(key));
  }

  private toJSON<T>(payload: string | null) {
    try {
      if (!payload) return null;
      return JSON.parse(payload) as unknown as T;
    } catch {
      return null;
    }
  }
}

interface RaidSeason {
  weekId: string;
  capitalTotalLoot: number;
  state: string;
  defensiveReward: number;
  totalAttacks: number;
  enemyDistrictsDestroyed: number;
  clanCapitalPoints: number;
  members: Required<APICapitalRaidSeason>['members'];
}
