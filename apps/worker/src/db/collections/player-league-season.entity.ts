export interface PlayerLeagueSeasonEntity {
  name: string;
  tag: string;
  seasonId: string;
  leagueId?: number;
  trophies: {
    initial: number;
    current: number;
  };
  versusTrophies: {
    initial: number;
    current: number;
  };
  updatedAt: Date;
  createdAt: Date;
}
