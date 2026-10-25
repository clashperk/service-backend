import { Season } from '@app/clash-client';

/** The most Clan Games points one member can earn. */
export const CLAN_GAMES_MAX_POINTS = 10_000;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const utc = (year: number, month: number, day: number, hour: number) =>
  new Date(Date.UTC(year, month, day, hour));

/** Clan Games run from the 22nd 08:00 to the 28th 08:00 UTC of their `YYYY-MM` season. */
export function clanGamesWindow(season: string) {
  const [year, month] = season.split('-').map(Number);
  return { startTime: utc(year, month - 1, 22, 8), endTime: utc(year, month - 1, 28, 8) };
}

/** Last month's games stay "latest" until the 20th, as in the bot's /clan-games. */
export function latestClanGamesSeason(now: Date) {
  const date = new Date(now);
  if (date.getUTCDate() < 20) date.setUTCMonth(date.getUTCMonth() - 1, 1);
  return date.toISOString().slice(0, 7);
}

/** The Clan Games that are running now, or the next ones. */
function currentOrNextClanGames(now: Date) {
  const season = now.toISOString().slice(0, 7);
  const window = clanGamesWindow(season);
  if (now < window.endTime) return window;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return clanGamesWindow(next.toISOString().slice(0, 7));
}

/** CWL signup opens on the 1st at 08:00 UTC; signup lasts 2 days and the league 9. */
function cwlWindow(year: number, month: number) {
  const startTime = utc(year, month, 1, 8);
  return {
    startTime,
    signupEndTime: new Date(startTime.getTime() + 2 * DAY),
    endTime: new Date(startTime.getTime() + 9 * DAY),
  };
}

function currentOrNextCwl(now: Date) {
  const thisMonth = cwlWindow(now.getUTCFullYear(), now.getUTCMonth());
  return now < thisMonth.endTime
    ? thisMonth
    : cwlWindow(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

/** Raid weekends run Friday 07:00 to Monday 07:00 UTC; this is the one starting on or before `date`. */
function raidWeekendFrom(date: Date) {
  const friday = utc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 7);
  friday.setUTCDate(friday.getUTCDate() - ((friday.getUTCDay() + 2) % 7));
  return { startTime: friday, endTime: new Date(friday.getTime() + 3 * DAY) };
}

function currentOrNextRaidWeekend(now: Date) {
  const weekend = raidWeekendFrom(now);
  return now < weekend.endTime
    ? weekend
    : raidWeekendFrom(new Date(weekend.startTime.getTime() + 7 * DAY));
}

export type GameEventType = 'season' | 'raid_weekend' | 'clan_games' | 'cwl';

export interface GameEvent {
  type: GameEventType;
  startTime: Date;
  endTime: Date;
  /** CWL only: when signup closes. */
  signupEndTime?: Date;
}

/** Each recurring event that is running now or comes next, soonest change first. */
export function upcomingEvents(now: Date): GameEvent[] {
  const season = Season.getLeagueSeason(now);
  const events: GameEvent[] = [
    { type: 'season', startTime: season.startTime, endTime: season.endTime },
    { type: 'raid_weekend', ...currentOrNextRaidWeekend(now) },
    { type: 'clan_games', ...currentOrNextClanGames(now) },
    { type: 'cwl', ...currentOrNextCwl(now) },
  ];
  const nextChange = (event: GameEvent) =>
    (now < event.startTime ? event.startTime : event.endTime).getTime();
  return events.sort((a, b) => nextChange(a) - nextChange(b));
}

/** Every event that overlaps `from`–`to`, by start time. */
export function eventsBetween(from: Date, to: Date): GameEvent[] {
  const events: GameEvent[] = [];
  for (
    let year = from.getUTCFullYear(), month = from.getUTCMonth() - 1;
    utc(year, month, 1, 0) < to;
    month++
  ) {
    const id = utc(year, month, 1, 0).toISOString().slice(0, 7);
    events.push({ type: 'clan_games', ...clanGamesWindow(id) });
    events.push({ type: 'cwl', ...cwlWindow(year, month) });
  }
  for (
    let start = raidWeekendFrom(from).startTime;
    start < to;
    start = new Date(start.getTime() + 7 * DAY)
  ) {
    events.push({
      type: 'raid_weekend',
      startTime: start,
      endTime: new Date(start.getTime() + 3 * DAY),
    });
  }
  for (
    let season = Season.getLeagueSeason(from);
    season.startTime < to;
    season = Season.getLeagueSeason(season.endTime)
  ) {
    events.push({ type: 'season', startTime: season.startTime, endTime: season.endTime });
  }
  return events
    .filter((event) => event.endTime > from && event.startTime < to)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
