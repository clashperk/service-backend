export class WorkerInitDto {
  tag: string;
  lastRan: Date;
  uniqueId: number;
}

export interface LoopMetrics {
  timeTaken: string;
  updated: string;
  updatedAt: Date;
}

export class LastSeenMembersInputDto {
  name: string;
  tag: string;
  leagueId: number;
  townHallLevel: number;
  trophies: number;
}
