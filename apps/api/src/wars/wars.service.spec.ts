import { NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { WarsService } from './wars.service';

// clash-client pulls in JSON the test setup can't load; getClanWar never calls it.
jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

type War = {
  id: number;
  state: string;
  endTime: Date;
  clan: { tag: string };
  opponent: { tag: string };
};

type Filter = { id: number; $or: Record<'clan.tag' | 'opponent.tag', string>[] };

const createService = (wars: War[]) => {
  const tagAt = (war: War, path: string) => (path === 'clan.tag' ? war.clan : war.opponent).tag;
  const collection = {
    findOne: (filter: Filter) =>
      Promise.resolve(
        wars.find(
          (war) =>
            war.id === filter.id &&
            filter.$or.some((cond) =>
              Object.entries(cond).every(([path, tag]) => tagAt(war, path) === tag),
            ),
        ) ?? null,
      ),
  };
  const db = { collection: () => collection } as unknown as Db;
  return new WarsService(db, null as never);
};

const war = (clan: string, opponent: string, endTime = new Date(Date.now() - 1000)): War => ({
  id: 7,
  state: 'inWar',
  endTime,
  clan: { tag: clan, stars: 3, destructionPercentage: 100 } as War['clan'],
  opponent: { tag: opponent, stars: 1, destructionPercentage: 50 } as War['opponent'],
});

describe('WarsService.getClanWar', () => {
  it("returns the war from the requested clan's side", async () => {
    const service = createService([war('#A', '#B')]);

    const result = await service.getClanWar({ clanTag: '#B', warId: '7' });

    expect(result.clan.tag).toBe('#B');
    expect(result.opponent.tag).toBe('#A');
  });

  it('reports a stored war past its end time as ended', async () => {
    const ended = await createService([war('#A', '#B')]).getClanWar({ clanTag: '#A', warId: '7' });
    expect(ended.state).toBe('warEnded');

    const running = await createService([
      war('#A', '#B', new Date(Date.now() + 60_000)),
    ]).getClanWar({ clanTag: '#A', warId: '7' });
    expect(running.state).toBe('inWar');
  });

  it('returns 404 for a war the clan was not in', async () => {
    const service = createService([war('#A', '#B')]);

    await expect(service.getClanWar({ clanTag: '#C', warId: '7' })).rejects.toThrow(
      NotFoundException,
    );
  });
});

type RawWar = {
  state: string;
  clan: { tag: string; stars: number; destructionPercentage: number };
  opponent: { tag: string; stars: number; destructionPercentage: number };
  startTime: string;
  preparationStartTime: string;
  endTime: string;
};

const rawWar = (state: string, clan: string, opponent: string): RawWar => ({
  state,
  clan: { tag: clan, stars: 10, destructionPercentage: 80 },
  opponent: { tag: opponent, stars: 8, destructionPercentage: 70 },
  startTime: '20261018T120000.000Z',
  preparationStartTime: '20261017T120000.000Z',
  endTime: '20261019T120000.000Z',
});

const createLiveService = (live: {
  currentWar?: RawWar | null;
  isWarLogPublic?: boolean;
  rounds?: string[][];
  leagueWars?: Record<string, RawWar>;
}) => {
  const clashClientService = {
    getCurrentWar: () =>
      Promise.resolve({
        body: live.currentWar ?? null,
        isWarLogPublic: live.isWarLogPublic ?? true,
      }),
    getClanWarLeagueGroup: () =>
      Promise.resolve(live.rounds ? { rounds: live.rounds.map((warTags) => ({ warTags })) } : null),
    getLeagueRoundWithWarTag: (warTag: string) =>
      Promise.resolve({ body: live.leagueWars?.[warTag] ?? null, warTag }),
  };
  return new WarsService({} as Db, clashClientService as never);
};

describe('WarsService.getCurrentWar', () => {
  it('returns the regular war from the clan side', async () => {
    const service = createLiveService({ currentWar: rawWar('inWar', '#A', '#B') });

    const { war, isWarLogPublic } = await service.getCurrentWar('#A');

    expect(isWarLogPublic).toBe(true);
    expect(war?.state).toBe('inWar');
    expect(war?.clan.tag).toBe('#A');
    expect(war?.round).toBeNull();
  });

  it('prefers the CWL round in war over the one in preparation', async () => {
    const service = createLiveService({
      currentWar: rawWar('notInWar', '#A', '#B'),
      rounds: [
        ['#W1', '#W2'],
        ['#W3', '#W4'],
        ['#W5', '#W6'],
        ['#0', '#0'],
      ],
      leagueWars: {
        '#W3': rawWar('inWar', '#C', '#D'),
        '#W4': rawWar('inWar', '#B', '#A'),
        '#W5': rawWar('preparation', '#A', '#C'),
        '#W6': rawWar('preparation', '#B', '#D'),
      },
    });

    const { war } = await service.getCurrentWar('#A');

    expect(war?.state).toBe('inWar');
    expect(war?.round).toBe(2);
    expect(war?.warTag).toBe('#W4');
    expect(war?.clan.tag).toBe('#A');
    expect(war?.opponent.tag).toBe('#B');
  });

  it('falls back to CWL when the war log is private', async () => {
    const service = createLiveService({
      isWarLogPublic: false,
      rounds: [['#W1']],
      leagueWars: { '#W1': rawWar('preparation', '#A', '#B') },
    });

    const { war, isWarLogPublic } = await service.getCurrentWar('#A');

    expect(isWarLogPublic).toBe(false);
    expect(war?.state).toBe('preparation');
    expect(war?.round).toBe(1);
  });

  it('returns no war when the clan is in neither', async () => {
    const service = createLiveService({ currentWar: rawWar('notInWar', '#A', '#B') });

    expect(await service.getCurrentWar('#A')).toEqual({ isWarLogPublic: true, war: null });
  });
});

type StoredWar = {
  id: number;
  warType: number;
  state: string;
  startTime: Date;
  endTime: Date;
  clan: { tag: string; stars: number; destructionPercentage: number };
  opponent: { tag: string; stars: number; destructionPercentage: number };
};

type ListFilter = {
  $or: Record<'clan.tag' | 'opponent.tag', string>[];
  startTime?: { $lt: Date };
};

const createListService = (wars: StoredWar[]) => {
  const collection = {
    find: (filter: ListFilter, options: { limit: number }) => ({
      toArray: () =>
        Promise.resolve(
          wars
            .filter((war) =>
              filter.$or.some(
                (cond) =>
                  cond['clan.tag'] === war.clan.tag || cond['opponent.tag'] === war.opponent.tag,
              ),
            )
            .filter((war) => !filter.startTime || war.startTime < filter.startTime.$lt)
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
            .slice(0, options.limit),
        ),
    }),
  };
  return new WarsService({ collection: () => collection } as unknown as Db, null as never);
};

const storedWar = (id: number, day: number, clan: string, opponent: string): StoredWar => ({
  id,
  warType: 1,
  state: 'warEnded',
  startTime: new Date(Date.UTC(2026, 9, day)),
  endTime: new Date(Date.UTC(2026, 9, day + 1)),
  clan: { tag: clan, stars: 30, destructionPercentage: 90 },
  opponent: { tag: opponent, stars: 20, destructionPercentage: 70 },
});

describe('WarsService.getClanWars', () => {
  const wars = [
    storedWar(1, 1, '#A', '#B'),
    storedWar(2, 3, '#C', '#A'),
    storedWar(3, 5, '#A', '#D'),
    storedWar(4, 7, '#E', '#F'),
  ];

  it("lists the clan's wars newest first from its own side", async () => {
    const { items, next } = await createListService(wars).getClanWars({
      clanTag: '#A',
      limit: 5,
    });

    expect(items.map((war) => war.id)).toEqual([3, 2, 1]);
    expect(items[1].clan.tag).toBe('#A');
    expect(items[1].result).toBe('lose');
    expect(items[0].result).toBe('win');
    expect(next).toBeNull();
  });

  it('pages with the start time of the last war', async () => {
    const service = createListService(wars);

    const first = await service.getClanWars({ clanTag: '#A', limit: 2 });
    expect(first.items.map((war) => war.id)).toEqual([3, 2]);
    expect(first.next).toBe(Date.UTC(2026, 9, 3));

    const second = await service.getClanWars({ clanTag: '#A', limit: 2, before: first.next! });
    expect(second.items.map((war) => war.id)).toEqual([1]);
    expect(second.next).toBeNull();
  });
});

type Attack = { stars: number; destructionPercentage: number };
type Member = { tag: string; name: string; townhallLevel: number; attacks?: Attack[] };
type CwlWar = {
  id: number;
  season: string;
  leagueGroupId: number | null;
  warTag: string;
  state: string;
  teamSize: number;
  startTime: Date;
  endTime: Date;
  clan: { tag: string; stars: number; destructionPercentage: number; members: Member[] };
  opponent: { tag: string; stars: number; destructionPercentage: number; members: Member[] };
};

const cwlWar = (
  id: number,
  season: string,
  day: number,
  warTag: string,
  members: Member[],
  options: { swap?: boolean; ended?: boolean; groupId?: number | null } = {},
): CwlWar => {
  const ours = { tag: '#A', stars: 20, destructionPercentage: 80, members };
  const theirs = { tag: `#X${id}`, stars: 10, destructionPercentage: 60, members: [] };
  const endTime =
    options.ended === false ? new Date(Date.now() + 60_000) : new Date(Date.UTC(2026, 9, day + 1));
  return {
    id,
    season,
    leagueGroupId: options.groupId === undefined ? 1 : options.groupId,
    warTag,
    state: options.ended === false ? 'inWar' : 'warEnded',
    teamSize: 15,
    startTime: new Date(Date.UTC(2026, 9, day)),
    endTime,
    clan: options.swap ? theirs : ours,
    opponent: options.swap ? ours : theirs,
  };
};

const createSeasonService = (
  wars: CwlWar[],
  groups: {
    id: number;
    rounds: { warTags: string[] }[];
    clans: { tag: string; leagueId: number }[];
  }[],
) => {
  const seasonsOf = (limit: number) =>
    [...new Set([...wars].sort((a, b) => +b.startTime - +a.startTime).map((war) => war.season))]
      .slice(0, limit)
      .map((_id) => ({ _id }));
  const collections = {
    ClanWars: {
      aggregate: (pipeline: { $limit?: number }[]) => ({
        toArray: () => Promise.resolve(seasonsOf(pipeline.find((stage) => stage.$limit)!.$limit!)),
      }),
      find: (filter: { season: { $in: string[] } }) => ({
        toArray: () =>
          Promise.resolve(
            wars
              .filter((war) => filter.season.$in.includes(war.season))
              .sort((a, b) => +a.startTime - +b.startTime),
          ),
      }),
    },
    CWLGroups: {
      find: (filter: { id: { $in: number[] } }) => ({
        toArray: () => Promise.resolve(groups.filter((group) => filter.id.$in.includes(group.id))),
      }),
    },
  };
  const db = { collection: (name: keyof typeof collections) => collections[name] } as unknown as Db;
  return new WarsService(db, null as never);
};

const member = (tag: string, townhallLevel: number, attacks?: Attack[]): Member => ({
  tag,
  name: `Player ${tag}`,
  townhallLevel,
  attacks,
});

describe('WarsService.getClanWarLeagueSeasons', () => {
  const group = {
    id: 1,
    rounds: [{ warTags: ['#R1', '#Z'] }, { warTags: ['#Z2', '#R2'] }, { warTags: ['#R3'] }],
    clans: [
      { tag: '#A', leagueId: 48000010 },
      { tag: '#B', leagueId: 48000010 },
    ],
  };
  const wars = [
    cwlWar(1, '2026-10', 1, '#R1', [
      member('#P1', 15, [{ stars: 3, destructionPercentage: 100 }]),
      member('#P2', 14),
    ]),
    cwlWar(2, '2026-10', 2, '#R2', [member('#P1', 16, [{ stars: 2, destructionPercentage: 90 }])], {
      swap: true,
    }),
    cwlWar(3, '2026-10', 3, '#R3', [member('#P2', 14)], { ended: false }),
    cwlWar(4, '2026-09', 1, '#OLD', [member('#P1', 15)], { groupId: null }),
  ];

  it('numbers rounds from the stored group and totals each member', async () => {
    const { items } = await createSeasonService(wars, [group]).getClanWarLeagueSeasons({
      clanTag: '#A',
      limit: 3,
    });

    expect(items.map((season) => season.season)).toEqual(['2026-10', '2026-09']);
    const [october, september] = items;
    expect(october.leagueId).toBe(48000010);
    expect(october.groupSize).toBe(2);
    expect(october.rounds.map((round) => round.round)).toEqual([1, 2, 3]);
    expect(october.rounds[1].clan.tag).toBe('#A');
    expect(october.rounds[2].state).toBe('inWar');

    expect(october.members.map((m) => m.tag)).toEqual(['#P1', '#P2']);
    expect(october.members[0]).toMatchObject({
      townHallLevel: 16,
      wars: 2,
      attacks: 2,
      stars: 5,
      threeStars: 1,
      destruction: 190,
      missed: 0,
    });
    // Missed only counts ended rounds, not the one still in war.
    expect(october.members[1]).toMatchObject({ wars: 2, attacks: 0, missed: 1 });

    expect(september.leagueId).toBeNull();
    expect(september.rounds[0].round).toBeNull();
  });

  it('limits the number of seasons', async () => {
    const { items } = await createSeasonService(wars, [group]).getClanWarLeagueSeasons({
      clanTag: '#A',
      limit: 1,
    });
    expect(items.map((season) => season.season)).toEqual(['2026-10']);
  });
});

type LeagueSide = {
  tag: string;
  stars: number;
  destructionPercentage: number;
  badgeUrls: { small: string };
};

const leagueWar = (state: string, a: [string, number, number], b: [string, number, number]) => {
  const side = ([tag, stars, destructionPercentage]: [string, number, number]): LeagueSide => ({
    tag,
    stars,
    destructionPercentage,
    badgeUrls: { small: `${tag}.png` },
  });
  return { state, teamSize: 15, clan: side(a), opponent: side(b) };
};

describe('WarsService.getClanWarLeagueStandings', () => {
  const group = {
    id: 9,
    season: '2026-10-02',
    clans: ['#A', '#B', '#C', '#D'].map((tag) => ({ tag, name: tag, leagueId: 48000010 })),
    rounds: [{ warTags: ['#W1', '#W2'] }, { warTags: ['#W3', '#W4'] }, { warTags: ['#0', '#0'] }],
  };

  const createStandingsService = (wars: Record<string, ReturnType<typeof leagueWar> | null>) => {
    const db = {
      collection: () => ({
        findOne: (filter: { 'id': number; 'clans.tag': string }) =>
          Promise.resolve(
            filter.id === group.id && group.clans.some((clan) => clan.tag === filter['clans.tag'])
              ? group
              : null,
          ),
      }),
    } as unknown as Db;
    const clashClientService = {
      getLeagueRoundWithWarTag: (warTag: string) =>
        Promise.resolve({ body: wars[warTag] ?? null, warTag }),
    };
    return new WarsService(db, clashClientService as never);
  };

  it('ranks by stars with 10 per win, then total destruction', async () => {
    const service = createStandingsService({
      '#W1': leagueWar('warEnded', ['#A', 40, 90], ['#B', 30, 80]),
      '#W2': leagueWar('warEnded', ['#C', 35, 85], ['#D', 35, 70]),
      '#W3': leagueWar('inWar', ['#A', 20, 50], ['#C', 25, 60]),
      '#W4': leagueWar('preparation', ['#B', 0, 0], ['#D', 0, 0]),
    });

    const standings = await service.getClanWarLeagueStandings({ clanTag: '#A', groupId: 9 });

    // #A and #C both reach 70 (the in-war round counts stars but no win); #C has more destruction.
    expect(standings.rows.map((row) => [row.tag, row.stars, row.wins])).toEqual([
      ['#C', 70, 1],
      ['#A', 70, 1],
      ['#D', 35, 0],
      ['#B', 30, 0],
    ]);
    expect(standings.rows[1].destruction).toBe(15 * 90 + 15 * 50);
    expect(standings.roundsPlayed).toBe(2);
    expect(standings.totalRounds).toBe(3);
    expect(standings.complete).toBe(true);
    expect(standings.rows[0].badgeUrls?.small).toBe(`${standings.rows[0].tag}.png`);
  });

  it('flags a table with wars that no longer load', async () => {
    const service = createStandingsService({
      '#W1': leagueWar('warEnded', ['#A', 40, 90], ['#B', 30, 80]),
    });

    const standings = await service.getClanWarLeagueStandings({ clanTag: '#A', groupId: 9 });

    expect(standings.complete).toBe(false);
    expect(standings.roundsPlayed).toBe(1);
  });

  it('returns 404 for a group the clan was not in', async () => {
    const service = createStandingsService({});
    await expect(service.getClanWarLeagueStandings({ clanTag: '#Z', groupId: 9 })).rejects.toThrow(
      NotFoundException,
    );
  });
});
