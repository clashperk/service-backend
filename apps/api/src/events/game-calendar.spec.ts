import {
  clanGamesWindow,
  eventsBetween,
  latestClanGamesSeason,
  upcomingEvents,
} from './game-calendar';

jest.mock('@app/clash-client', () => ({
  Season: {
    getLeagueSeason: (date = new Date('2026-10-18T00:00:00Z')) => {
      // 28-day seasons from 2026-09-28 05:00 UTC.
      const anchor = Date.parse('2026-09-28T05:00:00Z');
      const length = 28 * 24 * 60 * 60 * 1000;
      const start = anchor + Math.floor((date.getTime() - anchor) / length) * length;
      return { id: '', startTime: new Date(start), endTime: new Date(start + length) };
    },
  },
}));

const at = (iso: string) => new Date(iso);
const find = (now: Date, type: string) => upcomingEvents(now).find((event) => event.type === type)!;

describe('game calendar', () => {
  it('places Clan Games on the 22nd–28th at 08:00 UTC', () => {
    expect(clanGamesWindow('2026-10')).toEqual({
      startTime: at('2026-10-22T08:00:00Z'),
      endTime: at('2026-10-28T08:00:00Z'),
    });
  });

  it("keeps last month's Clan Games latest until the 20th", () => {
    expect(latestClanGamesSeason(at('2026-10-19T23:00:00Z'))).toBe('2026-09');
    expect(latestClanGamesSeason(at('2026-10-20T00:00:00Z'))).toBe('2026-10');
    expect(latestClanGamesSeason(at('2026-01-05T00:00:00Z'))).toBe('2025-12');
  });

  it('moves to next month once Clan Games end', () => {
    expect(find(at('2026-10-25T00:00:00Z'), 'clan_games').startTime).toEqual(
      at('2026-10-22T08:00:00Z'),
    );
    expect(find(at('2026-10-28T09:00:00Z'), 'clan_games').startTime).toEqual(
      at('2026-11-22T08:00:00Z'),
    );
  });

  it('finds the raid weekend running from Friday to Monday 07:00 UTC', () => {
    // 2026-10-18 is a Sunday: the weekend that started on Friday the 16th is running.
    expect(find(at('2026-10-18T12:00:00Z'), 'raid_weekend')).toMatchObject({
      startTime: at('2026-10-16T07:00:00Z'),
      endTime: at('2026-10-19T07:00:00Z'),
    });
    // Monday after 07:00 and midweek both point at the coming Friday.
    expect(find(at('2026-10-19T07:30:00Z'), 'raid_weekend').startTime).toEqual(
      at('2026-10-23T07:00:00Z'),
    );
    expect(find(at('2026-10-21T12:00:00Z'), 'raid_weekend').startTime).toEqual(
      at('2026-10-23T07:00:00Z'),
    );
    // Friday before 07:00 is still before that weekend.
    expect(find(at('2026-10-23T06:00:00Z'), 'raid_weekend').startTime).toEqual(
      at('2026-10-23T07:00:00Z'),
    );
  });

  it('keeps CWL on this month until the league ends, then the next', () => {
    expect(find(at('2026-10-05T00:00:00Z'), 'cwl')).toMatchObject({
      startTime: at('2026-10-01T08:00:00Z'),
      signupEndTime: at('2026-10-03T08:00:00Z'),
      endTime: at('2026-10-10T08:00:00Z'),
    });
    expect(find(at('2026-10-10T09:00:00Z'), 'cwl').startTime).toEqual(at('2026-11-01T08:00:00Z'));
  });

  it('orders events by their next start or end', () => {
    const types = upcomingEvents(at('2026-10-18T12:00:00Z')).map((event) => event.type);
    expect(types).toEqual(['raid_weekend', 'clan_games', 'season', 'cwl']);
  });

  it('lists every occurrence in a month, by start time', () => {
    const events = eventsBetween(at('2026-10-01T00:00:00Z'), at('2026-11-01T00:00:00Z'));
    const of = (type: string) =>
      events.filter((event) => event.type === type).map((event) => event.startTime.toISOString());
    expect(of('raid_weekend')).toEqual([
      '2026-10-02T07:00:00.000Z',
      '2026-10-09T07:00:00.000Z',
      '2026-10-16T07:00:00.000Z',
      '2026-10-23T07:00:00.000Z',
      '2026-10-30T07:00:00.000Z',
    ]);
    expect(of('clan_games')).toEqual(['2026-10-22T08:00:00.000Z']);
    expect(of('cwl')).toEqual(['2026-10-01T08:00:00.000Z']);
    expect(of('season')).toEqual(['2026-09-28T05:00:00.000Z', '2026-10-26T05:00:00.000Z']);
    const starts = events.map((event) => event.startTime.getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('keeps an event that started before the range but is still running', () => {
    const events = eventsBetween(at('2026-10-05T00:00:00Z'), at('2026-10-06T00:00:00Z'));
    expect(events.map((event) => event.type).sort()).toEqual(['cwl', 'raid_weekend', 'season']);
  });
});
