export class PlayersEntity {
  name: string;
  tag: string;
  clan?: {
    name: string;
    tag: string;
  };
  leagueId: number;
  townHallLevel: number;
  seasons: Record<string, number>;
  lastSeen: Date;
}
