import { Injectable, NotFoundException } from '@nestjs/common';
import { APIClanWar, APIClanWarLeagueGroup } from 'clashofclans.js';
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

  async getClanWarLeague(clanTag: string) {
    const { body, res } = await this.clashClient.getClanWarLeagueGroup(clanTag);
    if (!res.ok) throw new NotFoundException(`Clan ${clanTag} is not in CWL.`);
    const rounds = body.rounds.filter((round) => !round.warTags.includes('#0'));

    const warTags = rounds.map((round) => round.warTags).flat();
    const result = await Promise.all(
      warTags.map((warTag) => this.getLeagueRoundWithWarTag(warTag)),
    );

    const payload: {
      leagueGroup: APIClanWarLeagueGroup;
      rounds: (APIClanWar & { round: number; warTag: string })[];
    } = {
      leagueGroup: body,
      rounds: [],
    };

    for (const { body, warTag } of result) {
      if (!body) continue;
      const round = rounds.findIndex(({ warTags }) => warTags.includes(warTag)) + 1;
      payload.rounds.push({ ...body, round, warTag });
    }

    return payload;
  }

  private async getLeagueRoundWithWarTag(warTag: string) {
    const { res, body } = await this.clashClient.getClanWarLeagueRound(warTag);
    if (!res.ok) return { body: null, warTag };
    return { body, warTag };
  }
}
