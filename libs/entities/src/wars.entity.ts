import { APIClanWar } from 'clashofclans.js';

export interface ClanWarsEntity extends APIClanWar {
  warTag?: string;
  uuid: string;
  id: number;
  leagueGroupId?: number;
}
