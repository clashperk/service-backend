import { Season } from './client';

const at = (iso: string) => jest.useFakeTimers().setSystemTime(new Date(iso));

describe('Season ids', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the league season start date', () => {
    at('2026-11-02T04:59:59Z');
    expect(Season.leagueId).toBe('2026-10-05');

    at('2026-11-02T05:00:00Z');
    expect(Season.leagueId).toBe('2026-11-02');

    at('2026-11-30T06:00:00Z');
    expect(Season.leagueId).toBe('2026-11-30');
  });

  it('normalises a league season id to its start date', () => {
    expect(Season.toLeagueId('2026-11')).toBe('2026-10-05');
    expect(Season.toLeagueId('2026-10-05')).toBe('2026-10-05');
  });

  it('keys activity by calendar month', () => {
    at('2026-11-10T00:00:00Z');
    expect(Season.monthId).toBe('2026-11');
  });
});
