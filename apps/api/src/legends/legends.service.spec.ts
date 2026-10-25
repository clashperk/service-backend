import { Db } from 'mongodb';
import { LegendsService } from './legends.service';

vi.mock('@app/clash-client', () => ({ Season: { leagueId: '2026-10-05' } }));

const aggregate = vi.fn(() => ({ toArray: () => Promise.resolve([]) }));
const db = { collection: () => ({ aggregate }) } as unknown as Db;
const pipeline = () => (aggregate.mock.calls.at(-1) as unknown as [Record<string, unknown>[]])[0];

describe('LegendsService', () => {
  it('reads the current season unless one is given', async () => {
    const service = new LegendsService(db);
    await service.getLegendAttacks({ playerTags: ['#P'] });
    expect(pipeline()[0]).toEqual({ $match: { tag: { $in: ['#P'] }, seasonId: '2026-10-05' } });

    await service.getLegendAttacks({ playerTags: ['#P'] }, '2026-09-07');
    expect(pipeline()[0]).toEqual({ $match: { tag: { $in: ['#P'] }, seasonId: '2026-09-07' } });
  });

  it('lists the last 6 seasons, newest first', async () => {
    await new LegendsService(db).getLegendSeasons('#P');
    expect(pipeline().slice(0, 3)).toEqual([
      { $match: { tag: '#P' } },
      { $sort: { seasonId: -1 } },
      { $limit: 6 },
    ]);
  });
});
