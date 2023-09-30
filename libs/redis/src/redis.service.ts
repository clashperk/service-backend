import { RedisKeyPrefixes, Tokens } from '@app/constants';
import { Inject, Injectable } from '@nestjs/common';
import { APICapitalRaidSeason, APIClan } from 'clashofclans.js';
import { RedisClient } from './redis.module';

export const getRedisKey = (prefix: RedisKeyPrefixes, key: string): string => {
  return `${prefix}${key}`;
};

@Injectable()
export class RedisService {
  constructor(@Inject(Tokens.REDIS) private readonly redis: RedisClient) {}

  async getClan(clanTag: string): Promise<APIClan | null> {
    const result = await this.redis.json.get(getRedisKey(RedisKeyPrefixes.CLAN, clanTag));
    return result as unknown as APIClan;
  }

  async getCapitalRaidSeason(clanTag: string): Promise<PartialCapitalRaidSeason | null> {
    const result = await this.redis.json.get(
      getRedisKey(RedisKeyPrefixes.CAPITAL_RAID_SEASON, clanTag),
    );
    return result as unknown as PartialCapitalRaidSeason;
  }
}

export interface PartialCapitalRaidSeason {
  name: string;
  tag: string;
  weekId: string;
  state: string;
  capitalTotalLoot: number;
  defensiveReward: number;
  totalAttacks: number;
  enemyDistrictsDestroyed: number;
  clanCapitalPoints: number;
  members: Required<APICapitalRaidSeason>['members'];
}
