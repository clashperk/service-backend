import { APIClanWar } from 'clashofclans.js';

export interface ClanWarsEntity
  extends Omit<APIClanWar, 'preparationStartTime' | 'endTime' | 'startTime'> {
  warTag: string | null;
  uid: string;
  id: number;
  season: string;
  warType: number;
  leagueGroupId: number | null;
  preparationStartTime: Date;
  startTime: Date;
  endTime: Date;
}
