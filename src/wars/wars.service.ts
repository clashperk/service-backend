import { ClashClientService } from '@app/clash-client';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Util } from 'clashofclans.js';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { ClanWarLeaguesDto } from './dto';

@Injectable()
export class WarsService {
  constructor(
    @Inject(MONGODB_TOKEN) private db: Db,
    private clashClientService: ClashClientService,
  ) {}

  async getClanWarLeagueGroups(clanTag: string): Promise<ClanWarLeaguesDto> {
    return this.clashClientService.getClanWarLeague(clanTag);
  }

  async getClanWarLeagueForClan(clanTag: string): Promise<ClanWarLeaguesDto> {
    const leagueGroup = await this.db
      .collection(Collections.CWL_GROUPS)
      .findOne({ 'clans.tag': clanTag, 'season': Util.getSeasonId() });
    if (!leagueGroup) throw new NotFoundException(`Clan ${clanTag} is not in CWL.`);

    const result = await Promise.all(
      leagueGroup.warTags[clanTag].map((warTag) =>
        this.clashClientService.getLeagueRoundWithWarTag(warTag),
      ),
    );

    const payload: ClanWarLeaguesDto = {
      season: leagueGroup.season,
      rounds: leagueGroup.rounds,
      clans: leagueGroup.clans,
      wars: [],
    };

    for (const { body, warTag } of result) {
      if (!body) continue;
      const round = leagueGroup.rounds.findIndex(({ warTags }) => warTags.includes(warTag)) + 1;
      payload.wars.push({
        ...body,
        round,
        warTag,
      });
    }

    return payload;
  }
}
