export class CWLGroupsEntity {
  season: string;
  clans: {
    name: string;
    tag: string;
  };
  rounds: { warTags: string[] }[];
  warTags: Record<string, string[]>;
}
