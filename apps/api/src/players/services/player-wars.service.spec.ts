import { Db } from 'mongodb';
import { PlayerWarsService } from './player-wars.service';

vi.mock('@app/clash-client', () => ({ getPreviousBestAttack: () => null }));

type Attack = { stars: number; destructionPercentage: number };
type Side = {
  tag: string;
  name: string;
  members: { tag: string; attacks?: Attack[] }[];
};

const round = (
  day: number,
  leagueGroupId: number | null,
  ours: Side,
  options: { swap?: boolean; ended?: boolean } = {},
) => {
  const theirs: Side = { tag: `#X${day}`, name: `Enemy ${day}`, members: [] };
  return {
    season: leagueGroupId === 2 ? '2026-09' : '2026-10',
    leagueGroupId,
    attacksPerMember: 1,
    endTime:
      options.ended === false ? new Date(Date.now() + 60_000) : new Date(Date.UTC(2026, 9, day)),
    clan: options.swap ? theirs : ours,
    opponent: options.swap ? ours : theirs,
  };
};

const side = (tag: string, attacks?: Attack[]): Side => ({
  tag,
  name: `Clan ${tag}`,
  members: [{ tag: '#P', attacks }],
});

const createService = (rounds: ReturnType<typeof round>[]) => {
  const groups = [
    { id: 1, clans: [{ tag: '#A', leagueId: 48000018 }] },
    { id: 2, clans: [{ tag: '#B', leagueId: 48000015 }] },
  ];
  const db = {
    collection: (name: string) =>
      name === 'CWLGroups'
        ? {
            find: (filter: { id: { $in: number[] } }) => ({
              toArray: () => Promise.resolve(groups.filter((g) => filter.id.$in.includes(g.id))),
            }),
          }
        : { aggregate: () => ({ toArray: () => Promise.resolve(rounds) }) },
  } as unknown as Db;
  return new PlayerWarsService(db);
};

describe('PlayerWarsService.aggregateClanWarLeagueHistory', () => {
  it('totals each league group with its clan and league', async () => {
    const service = createService([
      round(5, 1, side('#A', [{ stars: 3, destructionPercentage: 100 }])),
      round(4, 1, side('#A'), { swap: true }),
      round(3, 1, side('#A', [{ stars: 2, destructionPercentage: 80 }])),
      round(6, 1, side('#A'), { ended: false }),
      round(2, 2, side('#B', [{ stars: 3, destructionPercentage: 100 }])),
    ]);
    const { items } = await service.aggregateClanWarLeagueHistory({
      playerTag: '#P',
      startDate: 0,
    });

    expect(items).toEqual([
      {
        season: '2026-10',
        clan: { tag: '#A', name: 'Clan #A' },
        leagueId: 48000018,
        wars: 4,
        attacks: 2,
        // The round still in war isn't missed yet.
        missed: 1,
        stars: 5,
        threeStars: 1,
        destruction: 180,
      },
      {
        season: '2026-09',
        clan: { tag: '#B', name: 'Clan #B' },
        leagueId: 48000015,
        wars: 1,
        attacks: 1,
        missed: 0,
        stars: 3,
        threeStars: 1,
        destruction: 100,
      },
    ]);
  });

  it('keeps rounds without a stored group, with no league', async () => {
    const service = createService([round(1, null, side('#C'))]);
    const { items } = await service.aggregateClanWarLeagueHistory({
      playerTag: '#P',
      startDate: 0,
    });
    expect(items[0]).toMatchObject({ clan: { tag: '#C' }, leagueId: null, wars: 1, missed: 1 });
  });
});
