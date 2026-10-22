import { RankedService } from './ranked.service';

jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

const member = (tag: string, trophies: number) => ({
  playerTag: tag,
  playerName: tag,
  clanTag: '',
  clanName: '',
  leagueTrophies: trophies,
  attackWinCount: 3,
  attackLoseCount: 1,
  defenseWinCount: 0,
  defenseLoseCount: 2,
});

const createService = (group: unknown) =>
  new RankedService({
    getPlayerOrThrow: () =>
      Promise.resolve({
        tag: '#ME',
        currentLeagueGroupTag: '#G',
        currentLeagueSeasonId: 1792386000,
        leagueTier: { id: 105000035 },
      }),
    getLeagueGroup: () => Promise.resolve(group),
    getLeagueHistory: () =>
      Promise.resolve([
        { leagueSeasonId: 1791176400, leagueTierId: 105000034, placement: 9 },
        { leagueSeasonId: 1791781200, leagueTierId: 105000035, placement: 4 },
      ]),
    getLeagueTiers: () =>
      Promise.resolve(
        new Map([[105000035, { id: 105000035, name: 'Legend II', iconUrls: { large: 'L' } }]]),
      ),
  } as never);

describe('RankedService.getRanked', () => {
  it("places the player in their group with the tier's zones", async () => {
    const members = Array.from({ length: 100 }, (_, i) => member(`#P${i}`, 2000 - i));
    members[2] = member('#ME', 1998);
    const { current } = await createService({
      members,
      attackLogs: [
        {
          opponentPlayerTag: '#A',
          opponentName: 'A',
          stars: 3,
          destructionPercentage: 100,
          trophies: 40,
          creationTime: '2026-10-20T09:00:00Z',
        },
        {
          opponentPlayerTag: '#B',
          opponentName: 'B',
          stars: 2,
          destructionPercentage: 80,
          trophies: 26,
          creationTime: '2026-10-21T09:00:00Z',
        },
      ],
      defenseLogs: [],
    }).getRanked('#ME');

    expect(current).toMatchObject({
      rank: 3,
      total: 100,
      promotionZone: 3,
      demotionZone: 15,
      trophies: 1998,
      league: { name: 'Legend II', iconUrl: 'L' },
      startTime: new Date('2026-10-19T05:00:00Z'),
      endTime: new Date('2026-10-26T05:00:00Z'),
    });
    expect(current!.attacks.map((a) => a.opponent.tag)).toEqual(['#B', '#A']);
  });

  it('has no current week without a group, and lists history newest first', async () => {
    const { current, history } = await createService(null).getRanked('#ME');
    expect(current).toBeNull();
    expect(history.map((h) => h.placement)).toEqual([4, 9]);
    expect(history[1].league).toEqual({ id: 105000034, name: 'Unknown league', iconUrl: null });
  });
});
