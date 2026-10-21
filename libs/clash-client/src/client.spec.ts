import { Season } from './client';

const at = (iso: string) => jest.useFakeTimers().setSystemTime(new Date(iso));

describe('Season ids', () => {
  afterEach(() => {
    jest.useRealTimers();
    delete process.env.SEASON_SPLIT;
  });

  it('keeps the legacy YYYY-MM id until the split is turned on', () => {
    at('2026-11-10T00:00:00Z');

    expect(Season.leagueId).toBe('2026-12');
  });

  it('uses the league season start date once split', () => {
    process.env.SEASON_SPLIT = '1';

    at('2026-11-02T04:59:59Z');
    expect(Season.leagueId).toBe('2026-10-05');

    at('2026-11-02T05:00:00Z');
    expect(Season.leagueId).toBe('2026-11-02');

    at('2026-11-30T06:00:00Z');
    expect(Season.leagueId).toBe('2026-11-30');
  });

  it('normalises a league season id to the scheme in use', () => {
    expect(Season.toLeagueId('2026-11')).toBe('2026-11');
    expect(Season.toLeagueId('2026-10-05')).toBe('2026-11');

    process.env.SEASON_SPLIT = '1';
    expect(Season.toLeagueId('2026-11')).toBe('2026-10-05');
    expect(Season.toLeagueId('2026-10-05')).toBe('2026-10-05');
  });
});
