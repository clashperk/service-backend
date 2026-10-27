// The worker rewrites each country's (or `global`) top 200 every few minutes until the
// league season ends, so a past season's document holds where it finished.

export class PlayerRanksEntity {
  countryCode: string;
  country: string;
  season: string;
  players: { tag: string; name: string; rank: number; trophies: number }[];
}

export class ClanRanksEntity {
  countryCode: string;
  country: string;
  season: string;
  clans: { tag: string; name: string; rank: number; clanPoints: number }[];
}

export class CapitalRanksEntity {
  countryCode: string;
  country: string;
  season: string;
  clans: { tag: string; name: string; rank: number; clanCapitalPoints: number }[];
}
