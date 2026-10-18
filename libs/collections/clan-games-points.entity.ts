/** One player's Clan Games points for one season (`YYYY-MM`), written by the worker. */
export class ClanGamesPointsEntity {
  name: string;
  tag: string;
  season: string;
  initial: number;
  current: number;
  clans: { name: string; tag: string; score: number; timestamp: number }[];
  __clans: string[];
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
