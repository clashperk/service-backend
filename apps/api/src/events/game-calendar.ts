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
function currentOrNextCwl(now: Date) {
  const thisMonth = utc(now.getUTCFullYear(), now.getUTCMonth(), 1, 8);
  const startTime =
    now.getTime() < thisMonth.getTime() + 9 * DAY
      ? thisMonth
      : utc(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 8);
  return {
    startTime,
    signupEndTime: new Date(startTime.getTime() + 2 * DAY),
    endTime: new Date(startTime.getTime() + 9 * DAY),
  };
}

/** Raid weekends run Friday 07:00 to Monday 07:00 UTC. */
function currentOrNextRaidWeekend(now: Date) {
  const friday = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7);
  friday.setUTCDate(friday.getUTCDate() - ((friday.getUTCDay() + 2) % 7));
  if (now.getTime() >= friday.getTime() + 3 * DAY) friday.setUTCDate(friday.getUTCDate() + 7);
  return { startTime: friday, endTime: new Date(friday.getTime() + 3 * DAY) };
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
  const season = Season.getSeason(now);
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
