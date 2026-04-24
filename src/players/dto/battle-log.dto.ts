import { IsString, Matches } from 'class-validator';

export class BattleLogDto {
  name: string;
  tag: string;
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

export class BattleLogLeaderboardInputDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'battleDate must be in YYYY-MM-DD format' })
  battleDate: string;

  @IsString({ each: true })
  playerTags: string[];
}

export class BattleLogLeaderboardItemDto {
  tag: string;
  name: string;
  trophies: number;
}

export class BattleLogLeaderboardDto {
  items: BattleLogLeaderboardItemDto[];
}
