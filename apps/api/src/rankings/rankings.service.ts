import { ClashClientService, Season } from '@app/clash-client';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db, Filter } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import {
  ClanBoardStandingDto,
  ClanRankingsDto,
  PlayerRankingSeasonDto,
  RankingBoard,
  RankingBoardDto,
  RankingEntryDto,
  RankingLocationDto,
  RankingStandingDto,
  SavedRankingBoard,
} from './dto';

const GLOBAL: RankingLocationDto = { countryCode: 'global', name: 'Global' };
const HISTORY_SEASONS = 6;

/** Where each saved board lives and which field holds its score. */
const SAVED = {
  [RankingBoard.PLAYERS]: {
    collection: Collections.PLAYER_RANKS,
    list: 'players',
    score: 'trophies',
  },
  [RankingBoard.CLANS]: { collection: Collections.CLAN_RANKS, list: 'clans', score: 'clanPoints' },
  [RankingBoard.CAPITAL]: {
    collection: Collections.CAPITAL_RANKS,
    list: 'clans',
    score: 'clanCapitalPoints',
  },
} as const;

/** The score field on a live ranking item of each board. */
const SCORE = {
  [RankingBoard.PLAYERS]: 'trophies',
  [RankingBoard.CLANS]: 'clanPoints',
  [RankingBoard.CAPITAL]: 'clanCapitalPoints',
  [RankingBoard.BUILDER_BASE_PLAYERS]: 'builderBaseTrophies',
  [RankingBoard.BUILDER_BASE_CLANS]: 'clanBuilderBasePoints',
} as const;

/** The fields every live board shares; clan boards add a badge, player boards a clan. */
type RankingItem = {
  tag: string;
  name: string;
  rank: number;
  previousRank: number;
  badgeUrls?: { small: string };
  clan?: { tag: string; name: string };
  [score: string]: unknown;
};

type SavedEntry = { tag: string; name: string; rank: number; score: number };
type SavedBoard = { countryCode: string; country: string; season: string; entries: SavedEntry[] };
type TagEntry = { countryCode: string; country: string; season: string; entry: SavedEntry };

const NO_BOARDS = Promise.resolve<SavedBoard[]>([]);
const NO_ENTRIES = Promise.resolve<TagEntry[]>([]);

const isSaved = (board: RankingBoard): board is SavedRankingBoard => board in SAVED;

/** The API sends 0 or -1 for an entry that wasn't ranked before. */
const knownRank = (rank: number | undefined) => (rank && rank > 0 ? rank : null);

const locationOf = (board: SavedBoard): RankingLocationDto => ({
  countryCode: board.countryCode,
  name: board.country,
});

const newestFirst = (a: string, b: string) =>
  Season.toLeagueId(b).localeCompare(Season.toLeagueId(a));

@Injectable()
export class RankingsService {
  constructor(
    @Inject(MONGODB_TOKEN) private db: Db,
    private clashClientService: ClashClientService,
  ) {}

  async getLocations(): Promise<RankingLocationDto[]> {
    const countries = await this.clashClientService.getCountries();
    return [
      GLOBAL,
      ...countries
        .map((country) => ({ countryCode: country.countryCode!, name: country.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }

  /** Saved seasons before the current one, newest first. */
  async getSeasons(): Promise<string[]> {
    const seasons = await this.db.collection(Collections.CLAN_RANKS).distinct('season');
    return seasons.filter((season) => season !== Season.leagueId).sort(newestFirst);
  }

  async getBoard(
    countryCode: string,
    board: RankingBoard,
    season?: string,
  ): Promise<RankingBoardDto> {
    const location = await this.findLocation(countryCode);
    if (!season) {
      return { location, board, season: null, items: await this.liveBoard(location, board) };
    }
    if (!isSaved(board)) {
      throw new BadRequestException(
        "Builder base boards aren't saved by season. Leave out season for the live board.",
      );
    }

    const seasons = await this.getSeasons();
    const previous = seasons[seasons.indexOf(season) + 1];
    const [current, before] = await Promise.all([
      this.readSaved(board, { countryCode, season }),
      previous ? this.readSaved(board, { countryCode, season: previous }) : NO_BOARDS,
    ]);
    if (!current.length) throw new NotFoundException('No saved board for that season.');

    const previousRanks = new Map(before[0]?.entries.map((entry) => [entry.tag, entry.rank]));
    return {
      location,
      board,
      season,
      items: current[0].entries.map((entry) => ({
        ...entry,
        previousRank: previousRanks.get(entry.tag) ?? null,
        badgeUrl: null,
        clan: null,
      })),
    };
  }

  /** This season's standing of each tag on every saved board it's on. */
  async getStandings(input: {
    playerTags?: string[];
    clanTags?: string[];
  }): Promise<RankingStandingDto[]> {
    const boards: [SavedRankingBoard, string[]][] = [
      [RankingBoard.PLAYERS, input.playerTags ?? []],
      [RankingBoard.CLANS, input.clanTags ?? []],
      [RankingBoard.CAPITAL, input.clanTags ?? []],
    ];
    const [previousSeason] = await this.getSeasons();

    const standings = await Promise.all(
      boards
        .filter(([, tags]) => tags.length > 0)
        .map(async ([board, tags]) => {
          const [current, before] = await Promise.all([
            this.findTags(board, tags, Season.leagueId),
            previousSeason ? this.findTags(board, tags, previousSeason) : NO_ENTRIES,
          ]);
          const previousRanks = new Map(
            before.map(({ countryCode, entry }) => [`${countryCode}:${entry.tag}`, entry.rank]),
          );
          return current.map(({ countryCode, country, entry }) => ({
            tag: entry.tag,
            name: entry.name,
            board,
            location: { countryCode, name: country },
            rank: entry.rank,
            previousRank: previousRanks.get(`${countryCode}:${entry.tag}`) ?? null,
            score: entry.score,
          }));
        }),
    );
    return standings.flat();
  }

  /** A clan's place on the clans and capital boards in its country and worldwide, and its history. */
  async getClanRankings(clanTag: string): Promise<ClanRankingsDto> {
    const clan = await this.clashClientService.getClanOrThrow(clanTag);
    const location =
      clan.location?.isCountry && clan.location.countryCode
        ? { countryCode: clan.location.countryCode, name: clan.location.name }
        : null;
    const countryCodes = location
      ? [location.countryCode, GLOBAL.countryCode]
      : [GLOBAL.countryCode];
    const seasons = await this.getSeasons();
    const [previousSeason] = seasons;

    const boards: ClanBoardStandingDto[] = (
      await Promise.all(
        [RankingBoard.CLANS, RankingBoard.CAPITAL].map(async (board: SavedRankingBoard) => {
          const [current, before] = await Promise.all([
            this.readSaved(board, { countryCode: { $in: countryCodes }, season: Season.leagueId }),
            previousSeason
              ? this.readSaved(board, {
                  countryCode: { $in: countryCodes },
                  season: previousSeason,
                })
              : NO_BOARDS,
          ]);
          return countryCodes.flatMap((countryCode) => {
            const saved = current.find((doc) => doc.countryCode === countryCode);
            if (!saved) return [];
            const entry = saved.entries.find((e) => e.tag === clan.tag);
            const previous = before
              .find((doc) => doc.countryCode === countryCode)
              ?.entries.find((e) => e.tag === clan.tag);
            return [
              {
                board,
                location: locationOf(saved),
                rank: entry?.rank ?? null,
                previousRank: previous?.rank ?? null,
                cutoff: saved.entries.at(-1)?.score ?? null,
              },
            ];
          });
        }),
      )
    ).flat();

    if (!location) return { location, boards, history: [] };

    const shown = seasons.slice(0, HISTORY_SEASONS);
    const [clans, capital] = await Promise.all(
      [RankingBoard.CLANS, RankingBoard.CAPITAL].map((board: SavedRankingBoard) =>
        this.readSaved(board, { countryCode: location.countryCode, season: { $in: shown } }),
      ),
    );
    const rankIn = (saved: SavedBoard[], season: string) =>
      saved.find((doc) => doc.season === season)?.entries.find((e) => e.tag === clan.tag)?.rank ??
      null;

    return {
      location,
      boards,
      history: shown.map((season) => ({
        season,
        clans: rankIn(clans, season),
        capital: rankIn(capital, season),
      })),
    };
  }

  /** Every saved season a player finished in a top 200, newest first. */
  async getPlayerRankings(playerTag: string): Promise<PlayerRankingSeasonDto[]> {
    const found = await this.findTags(RankingBoard.PLAYERS, [playerTag]);
    return found
      .filter(({ season }) => season !== Season.leagueId)
      .sort((a, b) => newestFirst(a.season, b.season))
      .map(({ season, countryCode, country, entry }) => ({
        season,
        location: { countryCode, name: country },
        rank: entry.rank,
        trophies: entry.score,
      }));
  }

  private async findLocation(countryCode: string) {
    const locations = await this.getLocations();
    const location = locations.find((l) => l.countryCode === countryCode);
    if (!location) throw new NotFoundException('No such country.');
    return location;
  }

  private async liveBoard(
    location: RankingLocationDto,
    board: RankingBoard,
  ): Promise<RankingEntryDto[]> {
    const locationId =
      location.countryCode === GLOBAL.countryCode
        ? 'global'
        : (await this.clashClientService.getCountries()).find(
            (country) => country.countryCode === location.countryCode,
          )!.id;
    const [items, previousRanks] = await Promise.all([
      this.clashClientService.getRankings(locationId, board),
      isSaved(board) ? this.lastSeasonRanks(board, location.countryCode) : null,
    ]);

    // Saved boards use ClashPerk's last saved season, as every other "since last season" does.
    return (items as unknown as RankingItem[]).map((item) => ({
      rank: item.rank,
      previousRank: previousRanks
        ? (previousRanks.get(item.tag) ?? null)
        : knownRank(item.previousRank),
      tag: item.tag,
      name: item.name,
      score: item[SCORE[board]] as number,
      badgeUrl: item.badgeUrls?.small ?? null,
      clan: item.clan ? { tag: item.clan.tag, name: item.clan.name } : null,
    }));
  }

  private async lastSeasonRanks(board: SavedRankingBoard, countryCode: string) {
    const [previousSeason] = await this.getSeasons();
    const saved = previousSeason
      ? await this.readSaved(board, { countryCode, season: previousSeason })
      : [];
    return new Map(saved[0]?.entries.map((entry) => [entry.tag, entry.rank]));
  }

  /** Saved boards matching a filter, each with its entries as `{ tag, name, rank, score }`. */
  private readSaved(board: SavedRankingBoard, filter: Filter<SavedBoard>): Promise<SavedBoard[]> {
    const { collection, list, score } = SAVED[board];
    return this.db
      .collection(collection)
      .aggregate<SavedBoard>([
        { $match: filter },
        {
          $project: {
            _id: 0,
            countryCode: 1,
            country: 1,
            season: 1,
            entries: {
              $map: {
                input: `$${list}`,
                as: 'e',
                in: { tag: '$$e.tag', name: '$$e.name', rank: '$$e.rank', score: `$$e.${score}` },
              },
            },
          },
        },
      ])
      .toArray();
  }

  /** Each saved board entry for these tags, in one season or all of them. */
  private async findTags(
    board: SavedRankingBoard,
    tags: string[],
    season?: string,
  ): Promise<TagEntry[]> {
    const { list } = SAVED[board];
    const saved = await this.readSaved(board, {
      [`${list}.tag`]: { $in: tags },
      ...(season ? { season } : {}),
    });
    return saved.flatMap((doc) =>
      doc.entries
        .filter((entry) => tags.includes(entry.tag))
        .map((entry) => ({
          countryCode: doc.countryCode,
          country: doc.country,
          season: doc.season,
          entry,
        })),
    );
  }
}
