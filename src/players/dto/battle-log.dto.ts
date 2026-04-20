export class BattleLogDto {
  playerTag: string;
  opponentTag: string;
  battleType: string;
  isAttack: boolean;
  stars: number;
  destruction: number;
  trophies: number;
  trophyChange: number;
  battleDate: string;
  ingestedAt: Date;
}

export class BattleLogItemsDto {
  items: BattleLogDto[];
}

export class BattleLogDailyDto {
  battleDate: string;
  trophies: number;
  offense: number;
  defense: number;
  gain: number;
}

export class BattleLogAggregateItemsDto {
  items: BattleLogDailyDto[];
}
