import { Injectable, NotFoundException } from '@nestjs/common';
import { ClashClient } from './client';

@Injectable()
export class ClashClientService {
  constructor(private clashClient: ClashClient) {}

  async getClan(clanTag: string) {
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

  async getClanWarLeagues(clanTag: string) {
    const { body, res } = await this.clashClient.getClanWarLeagueGroup(clanTag);
    if (!res.ok) throw new NotFoundException(`Clan ${clanTag} not found.`);

    return body;
  }
}
