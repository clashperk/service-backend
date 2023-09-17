import { Tokens } from '@app/constants';
import { Inject, Injectable } from '@nestjs/common';
import { RedisClient } from './redis.module';

@Injectable()
export class RedisService {
  constructor(@Inject(Tokens.REDIS) private readonly redis: RedisClient) {}
}
