import { Global, Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_TOKEN = 'REDIS_TOKEN';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_TOKEN,
      useFactory: (configService: ConfigService): Redis => {
        return new Redis(configService.getOrThrow('REDIS_URL'));
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_TOKEN],
})
export class RedisClientModule {
  constructor(@Inject(REDIS_TOKEN) private redis: Redis) {}

  onModuleInit() {
    this.redis.ping(); // eslint-disable-line
  }
}
