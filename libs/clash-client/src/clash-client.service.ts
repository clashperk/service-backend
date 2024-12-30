import { Tokens } from '@app/constants';
import { RedisService } from '@app/redis';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClashClient } from './clash-client.module';
import { APIClanWarAttack } from 'clashofclans.js';

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

  async getPlayer(playerTag: string) {
    const { body, res } = await this.clashClient.getPlayer(playerTag);
    if (!res.ok) return null;

    return body;
  }

  async getClanOrThrow(clanTag: string) {
    const { body, res } = await this.clashClient.getClan(clanTag);
    if (!res.ok) throw new NotFoundException(`Clan ${clanTag} not found.`);

    return body;
  }

  async getPlayerOrThrow(playerTag: string) {
    const { body, res } = await this.clashClient.getPlayer(playerTag);
    if (!res.ok) throw new NotFoundException(`Player ${playerTag} not found.`);

    return body;
  }

  public getPreviousBestAttack(
    attacks: APIClanWarAttack[],
    {
      defenderTag,
      attackerTag,
      order,
    }: { defenderTag: string; attackerTag: string; order: number },
  ) {
    const defenderDefenses = attacks.filter((atk) => atk.defenderTag === defenderTag);
    const isFresh =
      defenderDefenses.length === 0 ||
      order === Math.min(...defenderDefenses.map((def) => def.order));
    if (isFresh) return null;

    return (
      attacks
        .filter(
          (atk) =>
            atk.defenderTag === defenderTag && atk.order < order && atk.attackerTag !== attackerTag,
        )
        .sort((a, b) => b.destructionPercentage ** b.stars - a.destructionPercentage ** a.stars)
        .at(0) ?? null
    );
  }
}
