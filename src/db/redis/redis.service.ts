import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_TOKEN } from './redis.constants';

export class RedisService {
  constructor(@Inject(REDIS_TOKEN) private redis: Redis) {}
}
