import { Tokens } from '@app/constants';
import { Module, Provider } from '@nestjs/common';
import { createClient } from 'redis';
import { RedisService } from './redis.service';

export type RedisClient = ReturnType<typeof createClient>;
export declare type RedisJSON = null | boolean | number | string | Date;

const RedisProvider: Provider = {
  provide: Tokens.REDIS,
  useFactory: async (): Promise<RedisClient> => {
    const redis = createClient({
      url: process.env.REDIS_URL,
      database: Number(process.env.REDIS_DATABASE || 0),
    });
    return redis.connect().then(() => redis);
  },
};

const RedisPubProvider: Provider = {
  provide: Tokens.REDIS_PUB,
  useFactory: async (redis: RedisClient): Promise<RedisClient> => {
    return redis.duplicate();
  },
  inject: [Tokens.REDIS],
};

const RedisSubProvider: Provider = {
  provide: Tokens.REDIS_SUB,
  useFactory: async (redis: RedisClient): Promise<RedisClient> => {
    return redis.duplicate();
  },
  inject: [Tokens.REDIS],
};

@Module({
  providers: [RedisProvider, RedisPubProvider, RedisSubProvider, RedisService],
  exports: [RedisProvider, RedisPubProvider, RedisSubProvider, RedisService],
})
export class RedisModule {}
