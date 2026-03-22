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
  ingestedAt: string;
}

export class BattleLogItemsDto {
  items: BattleLogDto[];
}
