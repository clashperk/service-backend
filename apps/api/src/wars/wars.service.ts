import { ClashClientService } from '@app/clash-client';
import { ErrorCodes } from '@app/dto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APIClanWar, getWarResult } from 'clashofclans.js';
import moment from 'moment';
import { Db } from 'mongodb';
import { ClanWarsEntity, Collections, MONGODB_TOKEN } from '../db';
import { WarTypes } from '../players/dto/war-types.enum';
import { CwlArchiveService } from './cwl-archive.service';
import {
  ClanWarDto,
  ClanWarMemberTotalsDto,
  ClanWarLeagueSeasonsDto,
  ClanWarLeagueStandingsDto,
  ClanWarLeaguesDto,
  ClanWarListDto,
  ClanWarStatsDto,
  ClanWarSummaryDto,
  CurrentWarDto,
  WarStatsType,
} from './dto';

// Member lists make a stored war ~50 KB; the list only needs the score.
const SUMMARY_PROJECTION = {
  '_id': 0,
  'id': 1,
  'warType': 1,
  'state': 1,
  'teamSize': 1,
  'attacksPerMember': 1,
  'preparationStartTime': 1,
  'startTime': 1,
  'endTime': 1,
  'warTag': 1,
  'clan.tag': 1,
  'clan.name': 1,
  'clan.badgeUrls': 1,
  'clan.clanLevel': 1,
  'clan.attacks': 1,
  'clan.stars': 1,
  'clan.destructionPercentage': 1,
  'opponent.tag': 1,
  'opponent.name': 1,
  'opponent.badgeUrls': 1,
  'opponent.clanLevel': 1,
  'opponent.attacks': 1,
  'opponent.stars': 1,
  'opponent.destructionPercentage': 1,
};

const SEASON_PROJECTION = {
  '_id': 0,
  'id': 1,
  'season': 1,
  'leagueGroupId': 1,
  'warTag': 1,
  'state': 1,
  'teamSize': 1,
  'startTime': 1,
  'endTime': 1,
  'clan.tag': 1,
  'clan.name': 1,
  'clan.badgeUrls': 1,
  'clan.clanLevel': 1,
  'clan.attacks': 1,
  'clan.stars': 1,
  'clan.destructionPercentage': 1,
  'clan.members.tag': 1,
  'clan.members.name': 1,
  'clan.members.townhallLevel': 1,
  'clan.members.attacks.stars': 1,
  'clan.members.attacks.destructionPercentage': 1,
  'clan.members.attacks.defenderTag': 1,
  'opponent.tag': 1,
  'opponent.name': 1,
  'opponent.badgeUrls': 1,
  'opponent.clanLevel': 1,
  'opponent.attacks': 1,
  'opponent.stars': 1,
  'opponent.destructionPercentage': 1,
  'opponent.members.tag': 1,
  'opponent.members.name': 1,
  'opponent.members.townhallLevel': 1,
  'opponent.members.attacks.stars': 1,
  'opponent.members.attacks.destructionPercentage': 1,
  'opponent.members.attacks.defenderTag': 1,
};

// What member totals read from each side of a war.
const STATS_PROJECTION = {
  '_id': 0,
  'season': 1,
  'warType': 1,
  'state': 1,
  'startTime': 1,
  'endTime': 1,
  'attacksPerMember': 1,
  'clan.tag': 1,
  'clan.members.tag': 1,
  'clan.members.name': 1,
  'clan.members.townhallLevel': 1,
  'clan.members.attacks.stars': 1,
  'clan.members.attacks.destructionPercentage': 1,
  'clan.members.attacks.defenderTag': 1,
  'opponent.tag': 1,
  'opponent.members.tag': 1,
  'opponent.members.name': 1,
  'opponent.members.townhallLevel': 1,
  'opponent.members.attacks.stars': 1,
  'opponent.members.attacks.destructionPercentage': 1,
  'opponent.members.attacks.defenderTag': 1,
};

// The tracker can miss a war's last update and leave it "inWar" after it ended.
const storedState = <S extends string>(war: { state: S; endTime: Date }): S | 'warEnded' =>
  war.endTime.getTime() <= Date.now() ? 'warEnded' : war.state;

/** Each member's totals from the clan's side of the given wars (oldest first), most stars first. */
const memberTotals = (wars: ClanWarsEntity[], clanTag: string): ClanWarMemberTotalsDto[] => {
  const totals = new Map<string, ClanWarMemberTotalsDto>();
  for (const war of wars) {
    const clan = war.clan.tag === clanTag ? war.clan : war.opponent;
    const opponent = war.clan.tag === clanTag ? war.opponent : war.clan;
    const defenderTownHall = new Map(opponent.members.map((m) => [m.tag, m.townhallLevel]));
    const ended = storedState(war) === 'warEnded';
    for (const member of clan.members) {
      const total = totals.get(member.tag) ?? {
        tag: member.tag,
        name: member.name,
        townHallLevel: member.townhallLevel,
        wars: 0,
        attacks: 0,
        stars: 0,
        threeStars: 0,
        destruction: 0,
        missed: 0,
        sameThAttacks: 0,
        sameThThreeStars: 0,
      };
      // Wars are oldest first, so the last one seen sets the current name and Town Hall.
      total.name = member.name;
      total.townHallLevel = member.townhallLevel;
      total.wars += 1;
      const attacks = member.attacks ?? [];
      if (ended) total.missed += Math.max(0, (war.attacksPerMember || 1) - attacks.length);
      for (const attack of attacks) {
        total.attacks += 1;
        total.stars += attack.stars;
        total.destruction += attack.destructionPercentage;
        if (attack.stars === 3) total.threeStars += 1;
        if ((defenderTownHall.get(attack.defenderTag) ?? 0) >= member.townhallLevel) {
          total.sameThAttacks += 1;
          if (attack.stars === 3) total.sameThThreeStars += 1;
        }
      }
      totals.set(member.tag, total);
    }
  }
  return [...totals.values()].sort((a, b) => b.stars - a.stars || b.destruction - a.destruction);
};

@Injectable()
export class WarsService {
  constructor(
    @Inject(MONGODB_TOKEN) private db: Db,
    private clashClientService: ClashClientService,
    private cwlArchiveService: CwlArchiveService,
  ) {}

  async getClanWarLeagueGroups(clanTag: string): Promise<ClanWarLeaguesDto> {
    return this.clashClientService.getClanWarLeague(clanTag);
  }

  async getClanWarLeagueForClan(clanTag: string): Promise<ClanWarLeaguesDto> {
    // The clock can't tell which CWL season is current (the game's ids are unpredictable dates),
    // so use the clan's latest stored group.
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
      state: storedState(body),
      clan,
      opponent,
      result: getWarResult(clan, opponent),
    };
  }

  /** Stored wars the clan was on either side of, newest first; `before` pages by start time. */
  public async getClanWars(input: {
    clanTag: string;
    limit: number;
    before?: number;
  }): Promise<ClanWarListDto> {
    const { clanTag, limit, before } = input;
    const wars = await this.wars
      .find(
        {
          $or: [{ 'clan.tag': clanTag }, { 'opponent.tag': clanTag }],
          ...(before ? { startTime: { $lt: new Date(before) } } : {}),
        },
        { projection: SUMMARY_PROJECTION, sort: { startTime: -1 }, limit: limit + 1 },
      )
      .toArray();

    const page = wars.slice(0, limit);
    const items = page.map((war): ClanWarSummaryDto => {
      const clan = war.clan.tag === clanTag ? war.clan : war.opponent;
      const opponent = war.clan.tag === clanTag ? war.opponent : war.clan;
      return {
        id: war.id,
        warType: war.warType,
        state: storedState(war) as ClanWarSummaryDto['state'],
        teamSize: war.teamSize,
        attacksPerMember: war.attacksPerMember || 1,
        preparationStartTime: war.preparationStartTime,
        startTime: war.startTime,
        endTime: war.endTime,
        warTag: war.warTag ?? null,
        result: getWarResult(clan, opponent),
        clan,
        opponent,
      };
    });

    return {
      items,
      next: wars.length > limit ? page[page.length - 1].startTime.getTime() : null,
    };
  }

  /** Each member's totals over the clan's latest ended wars, or over its latest CWL seasons. */
  public async getClanWarStats(input: {
    clanTag: string;
    type: WarStatsType;
    wars: number;
    seasons: number;
  }): Promise<ClanWarStatsDto> {
    const { clanTag, type } = input;
    const ended = {
      $or: [{ 'clan.tag': clanTag }, { 'opponent.tag': clanTag }],
      endTime: { $lte: new Date() },
    };

    let wars: ClanWarsEntity[];
    if (type === 'cwl') {
      const match = { ...ended, warType: WarTypes.CWL };
      const seasons = await this.wars
        .aggregate<{
          _id: string;
        }>([
          { $match: match },
          { $group: { _id: '$season', start: { $max: '$startTime' } } },
          { $sort: { start: -1 } },
          { $limit: input.seasons },
        ])
        .toArray();
      wars = await this.wars
        .find(
          { ...match, season: { $in: seasons.map(({ _id }) => _id) } },
          { projection: STATS_PROJECTION, sort: { startTime: -1 } },
        )
        .toArray();
    } else {
      const warType =
        type === 'regular' ? WarTypes.REGULAR : { $in: [WarTypes.REGULAR, WarTypes.CWL] };
      wars = await this.wars
        .find(
          { ...ended, warType },
          { projection: STATS_PROJECTION, sort: { startTime: -1 }, limit: input.wars },
        )
        .toArray();
    }

    return {
      wars: wars.length,
      seasons: [
        ...new Set(
          wars.filter((war) => war.warType === Number(WarTypes.CWL)).map((war) => war.season),
        ),
      ],
      members: memberTotals([...wars].reverse(), clanTag),
    };
  }

  /** The clan's CWL seasons from its stored wars, newest first; standings need the whole group, so they aren't here. */
  public async getClanWarLeagueSeasons(input: {
    clanTag: string;
    limit: number;
  }): Promise<ClanWarLeagueSeasonsDto> {
    const { clanTag, limit } = input;
    const match = {
      $or: [{ 'clan.tag': clanTag }, { 'opponent.tag': clanTag }],
      warType: WarTypes.CWL,
    };
    const seasons = await this.wars
      .aggregate<{
        _id: string;
      }>([
        { $match: match },
        { $group: { _id: '$season', start: { $max: '$startTime' } } },
        { $sort: { start: -1 } },
        { $limit: limit },
      ])
      .toArray();
    if (!seasons.length) return { items: [] };

    const wars = await this.wars
      .find(
        { ...match, season: { $in: seasons.map(({ _id }) => _id) } },
        { projection: SEASON_PROJECTION, sort: { startTime: 1 } },
      )
      .toArray();
    const groupIds = [...new Set(wars.flatMap((war) => war.leagueGroupId ?? []))];
    const groups = await this.db
      .collection(Collections.CWL_GROUPS)
      .find(
        { id: { $in: groupIds } },
        { projection: { _id: 0, id: 1, season: 1, rounds: 1, clans: 1 } },
      )
      .toArray();

    return {
      items: seasons.map(({ _id: season }) => {
        const seasonWars = wars.filter((war) => war.season === season);
        const group = groups.find((group) => group.id === seasonWars[0].leagueGroupId);
        return {
          season,
          groupId: group?.id ?? null,
          groupSeason: group?.season ?? null,
          leagueId: group?.clans.find((clan) => clan.tag === clanTag)?.leagueId ?? null,
          groupSize: group?.clans.length ?? null,
          rounds: seasonWars.map((war) => {
            const clan = war.clan.tag === clanTag ? war.clan : war.opponent;
            const opponent = war.clan.tag === clanTag ? war.opponent : war.clan;
            const round = group?.rounds.findIndex(({ warTags }) => warTags.includes(war.warTag!));
            return {
              round: round === undefined || round < 0 ? null : round + 1,
              id: war.id,
              state: storedState(war) as 'preparation' | 'inWar' | 'warEnded',
              teamSize: war.teamSize,
              startTime: war.startTime,
              endTime: war.endTime,
              result: getWarResult(clan, opponent),
              clan: { ...clan, members: undefined },
              opponent: { ...opponent, members: undefined },
            };
          }),
          members: memberTotals(seasonWars, clanTag),
        };
      }),
    };
  }

  /** A stored group's table from its wars, fetched live by war tag; the game keeps them for a while after the season. */
  public async getClanWarLeagueStandings(input: {
    clanTag: string;
    groupId: number;
  }): Promise<ClanWarLeagueStandingsDto> {
    const group = await this.db
      .collection(Collections.CWL_GROUPS)
      .findOne({ 'id': input.groupId, 'clans.tag': input.clanTag });
    if (!group) throw new NotFoundException(ErrorCodes.NOT_FOUND);

    const rounds = group.rounds.map(({ warTags }) => warTags.filter((tag) => tag !== '#0'));
    const results = await Promise.all(
      rounds.flat().map((warTag) => this.clashClientService.getLeagueRoundWithWarTag(warTag)),
    );
    // The game drops war tags at the next CWL; the archive still has those wars.
    if (results.some(({ body }) => !body)) {
      const archived = await this.cwlArchiveService.getSeasonWars(input.clanTag, group.season);
      for (const result of results) {
        result.body ??= archived.get(result.warTag) ?? null;
      }
    }

    const rows = new Map(
      group.clans.map((clan) => [
        clan.tag,
        {
          tag: clan.tag,
          name: clan.name,
          badgeUrls: null as APIClanWar['clan']['badgeUrls'] | null,
          stars: 0,
          destruction: 0,
          wins: 0,
          leagueId: clan.leagueId,
        },
      ]),
    );
    const started = new Set<string>();
    for (const { body, warTag } of results) {
      if (!body || body.state === 'preparation') continue;
      started.add(warTag);
      const ended = body.state === 'warEnded';
      for (const [side, other] of [
        [body.clan, body.opponent],
        [body.opponent, body.clan],
      ]) {
        const row = rows.get(side.tag);
        if (!row) continue;
        row.badgeUrls = side.badgeUrls;
        row.stars += side.stars;
        row.destruction += side.destructionPercentage * body.teamSize;
        if (ended && getWarResult(side, other) === 'win') {
          row.stars += 10;
          row.wins += 1;
        }
      }
    }

    return {
      groupId: group.id,
      season: group.season,
      roundsPlayed: rounds.filter((tags) => tags.some((tag) => started.has(tag))).length,
      totalRounds: group.clans.length - 1,
      complete: results.every(({ body }) => body),
      rows: [...rows.values()].sort((a, b) => b.stars - a.stars || b.destruction - a.destruction),
    };
  }

  private get wars() {
    return this.db.collection(Collections.CLAN_WARS);
  }
}
