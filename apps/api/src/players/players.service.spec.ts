import { Db } from 'mongodb';
import { PlayersService } from './players.service';

// clash-client pulls in JSON the test setup can't load; getSeasonStats never calls it.
vi.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

const createService = (seasons: Record<string, unknown>[]) => {
  const cursor = {
    sort: () => cursor,
    limit: () => cursor,
    toArray: () => Promise.resolve(seasons),
  };
  const db = { collection: () => ({ find: () => cursor }) } as unknown as Db;
  return new PlayersService(null as never, db, null as never, null as never);
};

const counter = (initial: number, current: number) => ({ initial, current });

describe('PlayersService.getSeasonStats', () => {
  it('sums donations across clans and reports counters as gains', async () => {
    const service = createService([
      {
        season: '2026-10',
        townHallLevel: 15,
        attackWins: 42,
        defenseWins: 3,
        trophies: counter(4800, 5100),
        clanWarStars: counter(1000, 1012),
        capitalGoldContributions: counter(50_000, 61_500),
        clans: {
          '#A': {
            tag: '#A',
            name: 'A',
            donations: { current: 10, total: 300 },
            donationsReceived: { current: 0, total: 120 },
          },
          '#B': {
            tag: '#B',
            name: 'B',
            donations: { current: 5, total: 50 },
            donationsReceived: { current: 0, total: 30 },
          },
        },
      },
    ]);

    const [season] = (await service.getSeasonStats('#P', 2)).items;

    expect(season).toMatchObject({
      season: '2026-10',
      trophies: 5100,
      attackWins: 42,
      donations: 350,
      donationsReceived: 150,
      warStars: 12,
      capitalGold: 11_500,
      clanGamesPoints: 0,
    });
    expect(season.clans).toHaveLength(2);
  });
});
