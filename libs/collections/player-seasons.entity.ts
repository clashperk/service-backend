/** A tracked counter's value when the season started and its latest value. */
export class SeasonCounter {
  initial: number;
  current: number;
}

export class PlayerSeasonClan {
  tag: string;
  name: string;
  donations: { current: number; total: number };
  donationsReceived: { current: number; total: number };
}

/** One player's stats for one season, written by the worker. Only the fields the api reads. */
export class PlayerSeasonsEntity {
  name: string;
  tag: string;
  season: string;
  townHallLevel: number;
  attackWins: number;
  defenseWins: number;
  trophies: SeasonCounter;
  clans: Record<string, PlayerSeasonClan>;
  clanWarStars?: SeasonCounter;
  clanWarLeagueStars?: SeasonCounter;
  capitalGoldContributions?: SeasonCounter;
  clanGamesPoints?: SeasonCounter;
  goldLoots?: SeasonCounter;
  elixirLoots?: SeasonCounter;
  darkElixirLoots?: SeasonCounter;
  __clans: string[];
  createdAt: Date;
  updatedAt: Date;
}
