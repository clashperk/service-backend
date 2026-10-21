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
    expect(Season.statsId).toBe('2026-12');
  });

  it('uses the league start date for league data once split', () => {
    process.env.SEASON_SPLIT = '1';
    at('2026-11-10T00:00:00Z');

    expect(Season.leagueId).toBe('2026-11-02');
  });

  it('keys stats by league season before November 2026 and by month after', () => {
    process.env.SEASON_SPLIT = '1';

    at('2026-10-31T23:59:59Z');
    expect(Season.statsId).toBe('2026-10-05');
    expect(Season.monthlyStats).toBe(false);

    at('2026-11-01T00:00:00Z');
    expect(Season.statsId).toBe('2026-11');
    expect(Season.monthlyStats).toBe(true);

    at('2026-11-30T06:00:00Z');
    expect(Season.statsId).toBe('2026-11');
  });
});
