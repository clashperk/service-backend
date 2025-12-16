import { ClashClientService } from '@app/clash-client';
import { ErrorCodes } from '@app/dto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getWarResult, Util } from 'clashofclans.js';
import moment from 'moment';
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
    if (!leagueGroup) throw new NotFoundException(ErrorCodes.NOT_FOUND);

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
      const clan = body.clan.tag === clanTag ? body.clan : body.opponent;
      const opponent = body.clan.tag === clan.tag ? body.opponent : body.clan;

      payload.wars.push({
        ...body,
        startTime: moment(body.startTime).toDate(),
        preparationStartTime: moment(body.preparationStartTime).toDate(),
        endTime: moment(body.endTime).toDate(),
        clan,
        opponent,
        round,
        warTag,
        result: getWarResult(clan, opponent),
      });
    }

    return payload;
  }

  public async getClanWar(input: { clanTag: string; warId: string }) {
    const { clanTag, warId } = input;
    const body = await this.wars.findOne(
      { id: Number(warId) },
      {
        projection: {
          _id: 0,
          uid: 0,
          season: 0,
          warType: 0,
          updatedAt: 0,
          createdAt: 0,
        },
      },
    );
    if (!body) throw new NotFoundException(ErrorCodes.NOT_FOUND);

    const clan = [body.clan.tag, body.opponent.tag].includes(clanTag)
      ? body.clan.tag === clanTag
        ? body.clan
        : body.opponent
      : body.clan;
    const opponent = body.clan.tag === clan.tag ? body.opponent : body.clan;

    return {
      ...body,
      clan,
      opponent,
      result: getWarResult(clan, opponent),
    };
  }

  private get wars() {
    return this.db.collection(Collections.CLAN_WARS);
  }
}
