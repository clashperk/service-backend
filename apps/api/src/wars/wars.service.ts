import { ClashClientService } from '@app/clash-client';
import { ErrorCodes } from '@app/dto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APIClanWar, getWarResult } from 'clashofclans.js';
import moment from 'moment';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { ClanWarDto, ClanWarLeaguesDto, CurrentWarDto } from './dto';

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
    // The current CWL season is no longer a clock-derived YYYY-MM (the live API season is an
    // unpredictable YYYY-MM-DD), so fetch the latest stored group for the clan.
    const leagueGroup = await this.db
      .collection(Collections.CWL_GROUPS)
      .findOne({ 'clans.tag': clanTag }, { sort: { _id: -1 } });
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

  async getCurrentWar(clanTag: string): Promise<CurrentWarDto> {
    const { body, isWarLogPublic } = await this.clashClientService.getCurrentWar(clanTag);
    if (body && body.state !== 'notInWar') {
      return { isWarLogPublic, war: this.toClanWar(body, clanTag) };
    }

    // During CWL /currentwar reports notInWar; the round wars are public even with a private log.
    return { isWarLogPublic, war: await this.getCurrentLeagueWar(clanTag) };
  }

  private async getCurrentLeagueWar(clanTag: string): Promise<ClanWarDto | null> {
    const group = await this.clashClientService.getClanWarLeagueGroup(clanTag);
    if (!group) return null;

    // The last started round is usually in preparation and the one before it in war.
    const rounds = group.rounds
      .map((round, index) => ({ warTags: round.warTags, round: index + 1 }))
      .filter(({ warTags }) => !warTags.includes('#0'))
      .slice(-2);

    const wars = await Promise.all(
      rounds.flatMap(({ warTags, round }) =>
        warTags.map(async (warTag) => {
          const { body } = await this.clashClientService.getLeagueRoundWithWarTag(warTag);
          if (!body || (body.clan.tag !== clanTag && body.opponent.tag !== clanTag)) return null;
          return this.toClanWar(body, clanTag, { round, warTag });
        }),
      ),
    );

    const ours = wars.filter((war): war is ClanWarDto => !!war);
    return (
      ours.find((war) => war.state === 'inWar') ??
      ours.find((war) => war.state === 'preparation') ??
      ours.at(-1) ??
      null
    );
  }

  private toClanWar(
    body: APIClanWar,
    clanTag: string,
    league?: { round: number; warTag: string },
  ): ClanWarDto {
    const clan = body.clan.tag === clanTag ? body.clan : body.opponent;
    const opponent = body.clan.tag === clanTag ? body.opponent : body.clan;

    return {
      ...body,
      startTime: moment(body.startTime).toDate(),
      preparationStartTime: moment(body.preparationStartTime).toDate(),
      endTime: moment(body.endTime).toDate(),
      clan,
      opponent,
      round: league?.round ?? null,
      warTag: league?.warTag ?? null,
      result: getWarResult(clan, opponent),
    };
  }

  public async getClanWar(input: { clanTag: string; warId: string }) {
    const { clanTag, warId } = input;
    const body = await this.wars.findOne(
      { id: Number(warId), $or: [{ 'clan.tag': clanTag }, { 'opponent.tag': clanTag }] },
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

    const clan = body.clan.tag === clanTag ? body.clan : body.opponent;
    const opponent = body.clan.tag === clanTag ? body.opponent : body.clan;

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
