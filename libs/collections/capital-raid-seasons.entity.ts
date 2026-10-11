export class CapitalRaidSeasonsEntity {
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
  offensiveReward: number;
  defensiveReward: number;
  capitalTotalLoot: number;
  totalAttacks: number;
  enemyDistrictsDestroyed: number;
  raidsCompleted: number;
  clanCapitalPoints: number;
  capitalLeague: { id: number; name: string };
  _clanCapitalPoints: number;
  _capitalLeague: { id: number; name: string };
  updatedAt: Date;
  createdAt: Date;
}
