import { ClashClientService } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { GO_REDIS_TOKEN } from '../db';

@Injectable()
export class PlayersService {
  constructor(
    @Inject(GO_REDIS_TOKEN) private redis: Redis,
    private clashClientService: ClashClientService,
  ) {}

  async addPlayer(tag: string) {
    const player = await this.clashClientService.getPlayerOrThrow(tag);

    await this.redis.sadd('legend_player_tags', player.tag);
    return { message: 'Ok' };
  }
}
