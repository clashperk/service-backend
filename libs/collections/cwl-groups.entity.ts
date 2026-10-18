export class CWLGroupsEntity {
  /** Sequential group id; `ClanWars.leagueGroupId` points here. */
  id: number;
  season: string;
  clans: {
    name: string;
    tag: string;
    leagueId: number;
  }[];
  rounds: { warTags: string[] }[];
  warTags: { [clanTag: string]: string[] };
}
