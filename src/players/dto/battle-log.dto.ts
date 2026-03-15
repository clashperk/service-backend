export class BattleLogDto {
  playerTag: string;
  opponentTag: string;
  battleType: string;
  isAttack: boolean;
  stars: number;
  destruction: number;
  trophies: number;
  trophyChange: number;
  createdAt: string;
}

export class BattleLogItemsDto {
  items: BattleLogDto[];
}
