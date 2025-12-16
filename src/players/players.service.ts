import { ClashClientService } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { Db } from 'mongodb';
import { GO_REDIS_TOKEN, MONGODB_TOKEN } from '../db';

@Injectable()
export class PlayersService {
  constructor(
    @Inject(GO_REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    private clashClientService: ClashClientService,
  ) {}

  async addPlayer(tag: string) {
    const player = await this.clashClientService.getPlayerOrThrow(tag);
    await this.redis.sadd('legend_player_tags', player.tag);

    return { message: 'Ok' };
  }
}
