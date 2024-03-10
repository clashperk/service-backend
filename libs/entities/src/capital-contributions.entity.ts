export class CapitalContributionsEntity {
  name: string;
  tag: string;
  initial: number;
  current: number;
  clan: {
    name: string;
    tag: string;
  };
  season: string;
  createdAt: Date;
}
