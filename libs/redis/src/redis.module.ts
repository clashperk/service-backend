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

@Module({
  providers: [RedisProvider, RedisService],
  exports: [RedisProvider, RedisService],
})
export class RedisModule {}
