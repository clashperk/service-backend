export class LegendAttackLog {
  start: number;
  end: number;
  inc: number;
  timestamp: number;
  type: string;
}

export class LegendAttacksEntity {
  tag: string;
  name: string;
  initial: number;
  trophies: number;
  seasonId: string;
  logs: LegendAttackLog[];
  streak: number;

  attackLogs?: Record<string, number>;
  defenseLogs?: Record<string, number>;
}
