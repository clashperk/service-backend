export class CapitalContributionsEntity {
  name: string;
  tag: string;
  season: string;
  initial: number;
  current: number;
  clan: { name: string; tag: string };
  createdAt: Date;
}
