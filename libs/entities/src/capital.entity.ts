import { APICapitalRaidSeason } from 'clashofclans.js';

export interface CapitalRaidSeasonsEntity extends APICapitalRaidSeason {
  tag: string;
  name: string;
  weekId: string;
}
