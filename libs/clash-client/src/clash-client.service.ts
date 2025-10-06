import { Injectable, NotFoundException } from '@nestjs/common';
import { APIClanWar, APIClanWarLeagueRound, SearchOptions } from 'clashofclans.js';
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

  async getSeasonRankings(seasonId: string, opts: SearchOptions) {
    return this.clashClient.getSeasonRankings(29000022, seasonId, opts);
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

  async verifyPlayerOrThrow(playerTag: string, apiToken: string | null) {
    if (!apiToken) return false;

    const { body, res } = await this.clashClient.verifyPlayerToken(playerTag, apiToken);
    const isVerified = res.ok && body.status === 'ok';

    if (!isVerified) throw new NotFoundException(`Player ${playerTag} could not be verified.`);

    return isVerified;
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
      season: string;
      rounds: APIClanWarLeagueRound[];
      clans: { tag: string; name: string; leagueId: number }[];
      wars: (APIClanWar & { round: number; warTag: string })[];
    } = {
      season: body.season,
      clans: body.clans.map((clan) => ({
        tag: clan.tag,
        name: clan.name,
        leagueId: 0,
      })),
      rounds,
      wars: [],
    };

    for (const { body, warTag } of result) {
      if (!body) continue;
      const round = rounds.findIndex(({ warTags }) => warTags.includes(warTag)) + 1;
      payload.wars.push({ ...body, round, warTag });
    }

    return payload;
  }

  public async getLeagueRoundWithWarTag(warTag: string) {
    const { res, body } = await this.clashClient.getClanWarLeagueRound(warTag);
    if (!res.ok) return { body: null, warTag };
    return { body, warTag };
  }
}
