import { NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { WarsService } from './wars.service';

// clash-client pulls in JSON the test setup can't load; getClanWar never calls it.
jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

type War = { id: number; clan: { tag: string }; opponent: { tag: string } };

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

const war = (clan: string, opponent: string): War => ({
  id: 7,
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
