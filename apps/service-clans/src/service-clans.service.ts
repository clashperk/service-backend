import { Collections, Tokens } from '@app/constants';
import { LastSeenEntity } from '@app/entities';
import { MongodbService } from '@app/mongodb';
import { RedisClient, RedisService } from '@app/redis';
import RestHandler from '@app/rest/rest.module';
import { Inject, Injectable } from '@nestjs/common';
import { Collection, Db } from 'mongodb';

@Injectable()
export class ClansService {
  constructor(
    @Inject(Tokens.MONGODB) private db: Db,
    @Inject(Tokens.REDIS) private redis: RedisClient,
    @Inject(Tokens.REST) private restHandler: RestHandler,
    private redisService: RedisService,
    private mongoService: MongodbService,

    @Inject(Collections.LAST_SEEN)
    private lastSeenCollection: Collection<LastSeenEntity>,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }
}
