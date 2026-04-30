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
  battleSeason: string;
  battleWeek: string;
  leagueId: number;
  ingestedAt: Date;
}

export class BattleLogItemsDto {
  items: BattleLogDto[];
}

export class BattleLogDailyDto {
  name: string;
  tag: string;
  battleDate: string;
  trophies: number;
  offenseTrophies: number;
  defenseTrophies: number;
  gain: number;
  attackCount: number;
  defenseCount: number;
}

export class BattleLogAggregateItemsDto {
  items: BattleLogDailyDto[];
}

export class BattleLogLeaderboardInputDto {
  /**
   * @example "2026-05"
   */
  @Matches(/^\d{4}-\d{2}$/, { message: 'seasonId must be in YYYY-MM format' })
  seasonId: string;

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
