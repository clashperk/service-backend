import { Db } from 'mongodb';
import { ClanActivityService } from './clan-activity.service';

// clash-client pulls in JSON the test setup can't load; the service gets a stub instead.
jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

const rows = [
  {
    type: 'joined',
    playerTag: '#P1',
    playerName: '',
    clanTag: '#C1',
    clanName: '',
    value: '0',
    createdAt: '2026-10-18 03:33:31',
  },
  {
    type: 'town_hall_upgrade',
    playerTag: '#P2',
    playerName: 'Builder',
    clanTag: '#C1',
    clanName: 'Clan One',
    value: '16',
    createdAt: '2026-10-17 12:00:00',
  },
  {
    type: 'war_league_change',
    playerTag: '',
    playerName: '',
    clanTag: '#C1',
    clanName: 'Clan One',
    value: '48000010',
    createdAt: '2026-10-12 10:00:00',
  },
];

const collection = (docs: { tag: string; name: string }[]) =>
  ({
    collection: () => ({ find: () => ({ toArray: () => Promise.resolve(docs) }) }),
  }) as unknown as Db;

const query = jest.fn(() => Promise.resolve({ json: () => Promise.resolve(rows) }));

const createService = () =>
  new ClanActivityService(
    { query } as never,
    collection([{ tag: '#P1', name: 'Newcomer' }]),
    collection([{ tag: '#C1', name: 'Clan One' }]),
    { getLeagueNames: () => Promise.resolve(new Map([[48000010, 'Crystal League I']])) } as never,
  );

describe('ClanActivityService.getActivity', () => {
  it('fills missing names and splits levels from leagues', async () => {
    const { items } = await createService().getActivity({
      clanTags: ['#C1'],
      days: 7,
      limit: 50,
      types: ['joined', 'town_hall_upgrade', 'war_league_change'],
    });

    expect(items[0]).toEqual({
      type: 'joined',
      createdAt: new Date('2026-10-18T03:33:31Z'),
      clan: { tag: '#C1', name: 'Clan One' },
      player: { tag: '#P1', name: 'Newcomer' },
      level: null,
      league: null,
    });
    expect(items[1]).toMatchObject({ type: 'town_hall_upgrade', level: 16, league: null });
    expect(items[2]).toMatchObject({
      type: 'war_league_change',
      player: null,
      level: null,
      league: 'Crystal League I',
    });
  });

  it('filters by type in the query so the limit applies after filtering', async () => {
    await createService().getActivity({
      clanTags: ['#C1'],
      days: 7,
      limit: 20,
      types: ['joined', 'left'],
    });

    const [{ query: sql, query_params }] = query.mock.calls.at(-1) as unknown as [
      { query: string; query_params: Record<string, unknown> },
    ];
    expect(sql).toMatch(/WHERE type IN \{types:Array\(String\)\}\s+ORDER BY/);
    expect(sql).toContain('FROM clan_join_leave_logs');
    expect(query_params.types).toEqual(['joined', 'left']);
  });
});
