import { Tokens } from '@app/constants';
import { Module, Provider } from '@nestjs/common';
import { RedisService } from './redis.service';
import * as Redis from 'redis';

export type RedisClient = ReturnType<typeof Redis.createClient>;

const RedisProvider: Provider = {
  provide: Tokens.REDIS,
  useFactory: async (): Promise<RedisClient> => {
    const redis = Redis.createClient({
      url: process.env.REDIS_URL,
      database: Number(process.env.REDIS_DATABASE || 0),
    });
    return redis.connect().then(() => redis);
  },
};

@Module({
  providers: [RedisProvider, RedisService],
  exports: [RedisProvider, RedisService],
})
export class RedisModule {}
