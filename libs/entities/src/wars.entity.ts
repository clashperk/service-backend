import { APIClanWar } from 'clashofclans.js';

export interface ClanWarsEntity extends APIClanWar {
  warTag?: string;
  uid: string;
  id: number;
  leagueGroupId?: number;
}
