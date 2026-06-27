export interface CapitalContributionEntity {
  name: string;
  tag: string;
  season: string;
  initial: number;
  current: number;
  clan: { name: string; tag: string; contributed: number };
  createdAt: Date;
}
