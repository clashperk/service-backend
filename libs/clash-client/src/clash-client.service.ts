import { Tokens } from '@app/constants';
import { RedisService } from '@app/redis';
import { Inject, Injectable } from '@nestjs/common';
import { ClashClient } from './clash-client.module';

@Injectable()
export class ClashClientService {
  constructor(
    @Inject(Tokens.CLASH_CLIENT) private readonly clashClient: ClashClient,
    private redisService: RedisService,
  ) {}

  async getClan(clanTag: string) {
    const cached = await this.redisService.getClan(clanTag);
    if (cached) return cached;

    const { body, res } = await this.clashClient.getClan(clanTag);
    if (!res.ok) return null;

    return body;
  }
}
