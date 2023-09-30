import { Tokens } from '@app/constants';
import { RedisService } from '@app/redis';
import { Inject, Injectable } from '@nestjs/common';
import RestHandler from './rest.module';

@Injectable()
export class RestService {
  constructor(
    @Inject(Tokens.REST) private readonly restHandler: RestHandler,
    private redisService: RedisService,
  ) {}

  async getClan(clanTag: string) {
    const cached = await this.redisService.getClan(clanTag);
    if (cached) return cached;

    const { body, res } = await this.restHandler.getClan(clanTag);
    if (!res.ok) return null;

    return body;
  }
}
