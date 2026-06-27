export class CWLGroupsEntity {
  id: number;
  next: number;
  season: string;
  uid: string;
  clans: {
    name: string;
    tag: string;
    leagueId: number;
  }[];
  leagues: { [clanTag: string]: number };
  rounds: { warTags: string[] }[];
  warTags: { [clanTag: string]: string[] };
}
