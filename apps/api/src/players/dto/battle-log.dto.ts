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
  startTrophies: number = 0;
  endTrophies: number = 0;
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
   * The league season's start date. A legacy `YYYY-MM` season id is still accepted.
   * @example "2026-10-05"
   */
  @Matches(/^\d{4}-\d{2}(-\d{2})?$/, { message: 'seasonId must be in YYYY-MM-DD format' })
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
