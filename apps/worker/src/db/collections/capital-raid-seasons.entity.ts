export interface CapitalRaidSeasonEntity {
  name: string;
  tag: string;
  weekId: string;
  state: string;
  members: {
    name: string;
    tag: string;
    attacks: number;
    attackLimit: number;
    bonusAttackLimit: number;
    capitalResourcesLooted: number;
  }[];
  badgeURL: string;
  startDate: Date;
  endDate: Date;
  defensiveReward: number;
  capitalTotalLoot: number;
  offensiveReward: number;
  totalAttacks: number;
  enemyDistrictsDestroyed: number;
  raidsCompleted: number;
  updatedAt: Date;
  createdAt: Date;
}
