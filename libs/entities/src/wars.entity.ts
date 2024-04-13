import { APIClanWar } from 'clashofclans.js';

export interface ClanWarsEntity extends APIClanWar {
  warTag?: string;
  uid: string;
  id: number;
  warType: number;
  leagueGroupId?: number;
}
