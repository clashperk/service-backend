import { RedisKeyPrefixes, Tokens } from '@app/constants';
import { Inject, Injectable } from '@nestjs/common';
import { APIClan } from 'clashofclans.js';
import { RedisClient } from './redis.module';

export const getRedisKey = (prefix: RedisKeyPrefixes, key: string): string => {
  return `${prefix}:${key}`;
};

@Injectable()
export class RedisService {
  constructor(@Inject(Tokens.REDIS) private readonly redis: RedisClient) {}

  async getTrackedClans(): Promise<TrackedClanList[]> {
    const result = await this.redis.json.get(getRedisKey(RedisKeyPrefixes.LINKED_CLANS, 'ALL'));
    return (result ?? []) as unknown as TrackedClanList[];
  }

  async getClan(clanTag: string): Promise<APIClan | null> {
    const result = await this.redis.json.get(getRedisKey(RedisKeyPrefixes.CLAN, clanTag));
    return result as unknown as APIClan;
  }
}

export interface TrackedClanList {
  clan: string;
  tag: string;
  isPatron: boolean;
  guildIds: string[];
}
