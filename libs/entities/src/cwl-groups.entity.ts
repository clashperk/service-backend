export class CWLGroupsEntity {
  season: string;
  clans: {
    name: string;
    tag: string;
    leagueId: number;
  }[];
  rounds: { warTags: string[] }[];
  warTags: Record<string, string[]>;
}
