export interface APIPlayerTransformed {
  name: string;
  tag: string;
  townHallLevel: number;
  townHallWeaponLevel?: number;
  expLevel: number;
  trophies: number;
  bestTrophies: number;
  warStars: number;
  attackWins: number;
  defenseWins: number;
  builderHallLevel?: number;
  builderBaseTrophies?: number;
  bestBuilderBaseTrophies?: number;
  donations: number;
  donationsReceived: number;
  clanCapitalContributions: number;
  role?: string | null;
  warPreference?: string | null;
  clan?: {
    tag: string;
    name: string;
    donations: number;
    donationsReceived: number;
  } | null;
  leagueId: number;
  builderBaseLeagueId: number;

  leagueGroupTag: string;
  leagueSeasonId: number;

  achievements: { [id: string]: number };
  units: { [id: string]: number };
  heroes: {
    [id: string]: {
      level: number;
      equipment: { [id: string]: number };
    };
  };
  superTroops: { [id: string]: number };

  initialClanGamesPoints: number;
  builderBattleWins: number;

  labels: number[];

  seasonId: string;
  monthId: string;
  ex: number;
  version: number;
}

export interface PartialMember {
  tag: string;
  role: string;
  name: string;
  donations: number;
  donationsReceived: number;
}
