import { Tokens } from '@app/constants';
import { MongodbService } from '@app/mongodb';
import { RedisClient, RedisService } from '@app/redis';
import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';

@Injectable()
export class AppService {
  constructor(
    @Inject(Tokens.MONGODB) private readonly db: Db,
    @Inject(Tokens.REDIS) private readonly redis: RedisClient,
    private readonly redisService: RedisService,
    private readonly mongoService: MongodbService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }
}
