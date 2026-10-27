import { ClashClientService } from '@app/clash-client';
import { Db } from 'mongodb';
import { Collections } from '../db';
import { RankingBoard } from './dto';
import { RankingsService } from './rankings.service';

vi.mock('@app/clash-client', () => ({
  ClashClientService: class {},
  Season: { leagueId: '2026-10-05', toLeagueId: (id: string) => id },
}));

type Entry = { tag: string; name: string; rank: number; score: number };
type Doc = { countryCode: string; country: string; season: string; entries: Entry[] };

const entry = (tag: string, rank: number, score = 1000 - rank): Entry => ({
  tag,
  name: tag,
  rank,
  score,
});
const doc = (countryCode: string, season: string, entries: Entry[]): Doc => ({
  countryCode,
  country: countryCode === 'global' ? 'Global' : 'India',
  season,
  entries,
});

/** A Mongo stand-in holding boards already in the `{ entries }` shape `readSaved` projects to. */
function fakeDb(boards: Partial<Record<Collections, Doc[]>>) {
  const matches = (d: Doc, filter: Record<string, unknown>) =>
    Object.entries(filter).every(([key, want]) => {
      if (key.endsWith('.tag')) {
        const tags = (want as { $in: string[] }).$in;
        return d.entries.some((e) => tags.includes(e.tag));
      }
      const value = d[key as keyof Doc];
      return typeof want === 'object' && want !== null && '$in' in want
        ? (want.$in as unknown[]).includes(value)
        : value === want;
    });
  return {
    collection: (name: Collections) => ({
      distinct: () => Promise.resolve([...new Set((boards[name] ?? []).map((d) => d.season))]),
      aggregate: (pipeline: { $match: Record<string, unknown> }[]) => ({
        toArray: () =>
          Promise.resolve((boards[name] ?? []).filter((d) => matches(d, pipeline[0].$match))),
      }),
    }),
  } as unknown as Db;
}

const clash = (location?: { countryCode: string; name: string }, live: object[] = []) =>
  ({
    getCountries: () => Promise.resolve([{ id: 32000113, name: 'India', countryCode: 'IN' }]),
    getRankings: () => Promise.resolve(live),
    getClanOrThrow: (tag: string) =>
      Promise.resolve({ tag, location: location && { ...location, isCountry: true } }),
  }) as unknown as ClashClientService;

describe('RankingsService', () => {
  it('lists saved seasons newest first, without the running one', async () => {
    const service = new RankingsService(
      fakeDb({
        [Collections.CLAN_RANKS]: [
          doc('IN', '2026-09-07', []),
          doc('IN', '2026-10-05', []),
          doc('IN', '2026-08-10', []),
        ],
      }),
      clash(),
    );
    expect(await service.getSeasons()).toEqual(['2026-09-07', '2026-08-10']);
  });

  it("gives a saved board each entry's rank from the season before", async () => {
    const service = new RankingsService(
      fakeDb({
        [Collections.CLAN_RANKS]: [
          doc('IN', '2026-09-07', [entry('#A', 1), entry('#B', 2)]),
          doc('IN', '2026-08-10', [entry('#B', 1)]),
        ],
      }),
      clash(),
    );
    const board = await service.getBoard('IN', RankingBoard.CLANS, '2026-09-07');
    expect(board.items.map((e) => [e.tag, e.rank, e.previousRank])).toEqual([
      ['#A', 1, null],
      ['#B', 2, 1],
    ]);
  });

  it("compares a live board with last season's saved ranks; builder base keeps the API's", async () => {
    const live = [
      { tag: '#A', name: 'A', rank: 1, previousRank: 1, clanCapitalPoints: 5000 },
      { tag: '#B', name: 'B', rank: 2, previousRank: -1, clanCapitalPoints: 4900 },
    ];
    const service = new RankingsService(
      fakeDb({
        [Collections.CLAN_RANKS]: [doc('IN', '2026-09-07', [])],
        [Collections.CAPITAL_RANKS]: [doc('IN', '2026-09-07', [entry('#B', 3)])],
      }),
      clash(undefined, live),
    );
    const capital = await service.getBoard('IN', RankingBoard.CAPITAL);
    expect(capital.items.map((e) => [e.tag, e.previousRank, e.score])).toEqual([
      ['#A', null, 5000],
      ['#B', 3, 4900],
    ]);
    const builder = await service.getBoard('IN', RankingBoard.BUILDER_BASE_CLANS);
    expect(builder.items.map((e) => e.previousRank)).toEqual([1, null]);
  });

  it('refuses a saved builder base board', async () => {
    const service = new RankingsService(fakeDb({}), clash());
    await expect(
      service.getBoard('IN', RankingBoard.BUILDER_BASE_CLANS, '2026-09-07'),
    ).rejects.toThrow("Builder base boards aren't saved");
  });

  it('finds the tags on every board this season, with last season’s rank', async () => {
    const service = new RankingsService(
      fakeDb({
        [Collections.CLAN_RANKS]: [
          doc('IN', '2026-10-05', [entry('#X', 1), entry('#C', 5)]),
          doc('global', '2026-10-05', [entry('#C', 180)]),
          doc('IN', '2026-09-07', [entry('#C', 7)]),
        ],
        [Collections.CAPITAL_RANKS]: [doc('IN', '2026-10-05', [entry('#C', 41)])],
        [Collections.PLAYER_RANKS]: [doc('IN', '2026-10-05', [entry('#P', 88)])],
      }),
      clash(),
    );
    const standings = await service.getStandings({ clanTags: ['#C'], playerTags: ['#P'] });
    expect(
      standings.map((s) => [s.board, s.location.countryCode, s.tag, s.rank, s.previousRank]),
    ).toEqual([
      [RankingBoard.PLAYERS, 'IN', '#P', 88, null],
      [RankingBoard.CLANS, 'IN', '#C', 5, 7],
      [RankingBoard.CLANS, 'global', '#C', 180, null],
      [RankingBoard.CAPITAL, 'IN', '#C', 41, null],
    ]);
  });

  it("places a clan on its country's and the global boards, with the cut-off and history", async () => {
    const service = new RankingsService(
      fakeDb({
        [Collections.CLAN_RANKS]: [
          doc('IN', '2026-10-05', [entry('#C', 5), entry('#Z', 200, 41880)]),
          doc('global', '2026-10-05', [entry('#G', 200, 60000)]),
          doc('IN', '2026-09-07', [entry('#C', 7)]),
          doc('IN', '2026-08-10', [entry('#Z', 1)]),
        ],
        [Collections.CAPITAL_RANKS]: [],
      }),
      clash({ countryCode: 'IN', name: 'India' }),
    );
    const rankings = await service.getClanRankings('#C');

    expect(rankings.location).toEqual({ countryCode: 'IN', name: 'India' });
    expect(rankings.boards).toEqual([
      {
        board: RankingBoard.CLANS,
        location: { countryCode: 'IN', name: 'India' },
        rank: 5,
        previousRank: 7,
        cutoff: 41880,
      },
      {
        board: RankingBoard.CLANS,
        location: { countryCode: 'global', name: 'Global' },
        rank: null,
        previousRank: null,
        cutoff: 60000,
      },
    ]);
    expect(rankings.history).toEqual([
      { season: '2026-09-07', clans: 7, capital: null },
      { season: '2026-08-10', clans: null, capital: null },
    ]);
  });

  it('gives a clan without a country only the global boards and no history', async () => {
    const service = new RankingsService(
      fakeDb({ [Collections.CLAN_RANKS]: [doc('global', '2026-10-05', [entry('#C', 3)])] }),
      clash(),
    );
    const rankings = await service.getClanRankings('#C');
    expect(rankings.location).toBeNull();
    expect(rankings.boards.map((b) => [b.location.countryCode, b.rank])).toEqual([['global', 3]]);
    expect(rankings.history).toEqual([]);
  });

  it("lists a player's past finishes newest first, leaving out the running season", async () => {
    const service = new RankingsService(
      fakeDb({
        [Collections.PLAYER_RANKS]: [
          doc('IN', '2026-08-10', [entry('#P', 131, 5210)]),
          doc('IN', '2026-10-05', [entry('#P', 20, 5600)]),
          doc('global', '2026-09-07', [entry('#P', 4120, 5611)]),
        ],
      }),
      clash(),
    );
    expect(await service.getPlayerRankings('#P')).toEqual([
      {
        season: '2026-09-07',
        location: { countryCode: 'global', name: 'Global' },
        rank: 4120,
        trophies: 5611,
      },
      {
        season: '2026-08-10',
        location: { countryCode: 'IN', name: 'India' },
        rank: 131,
        trophies: 5210,
      },
    ]);
  });
});
