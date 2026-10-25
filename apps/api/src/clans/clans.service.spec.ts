import { Db } from 'mongodb';
import { ClansService } from './clans.service';

// clash-client pulls in JSON the test setup can't load; getClanGames never calls it.
vi.mock('@app/clash-client', () => ({ ClashClientService: class {}, Season: {} }));

type Player = {
  name: string;
  tag: string;
  initial: number;
  current: number;
  completedAt: Date | null;
};

const createService = (players: Player[]) => {
  const collection = {
    find: () => ({ limit: () => ({ toArray: () => Promise.resolve(players) }) }),
  };
  const db = { collection: () => collection } as unknown as Db;
  return new ClansService(null as never, null as never, db);
};

const player = (tag: string, points: number, completedAt: string | null = null): Player => ({
  name: tag,
  tag,
  initial: 1000,
  current: 1000 + points,
  completedAt: completedAt ? new Date(completedAt) : null,
});

describe('ClansService.getClanGames', () => {
  it('ranks by points, then by who finished first, and caps the clan total', async () => {
    const service = createService([
      player('#LATE', 10_000, '2026-10-25T10:00:00Z'),
      player('#LOW', 1500),
      player('#EARLY', 10_000, '2026-10-23T10:00:00Z'),
      player('#OVER', 12_000, '2026-10-24T10:00:00Z'),
    ]);

    const games = await service.getClanGames('#CLAN', '2026-10');

    expect(games.members.map((m) => m.tag)).toEqual(['#OVER', '#EARLY', '#LATE', '#LOW']);
    expect(games.maxPoints).toBe(10_000);
    expect(games.totalPoints).toBe(31_500);
    expect(games.startTime).toEqual(new Date('2026-10-22T08:00:00Z'));
  });
});
