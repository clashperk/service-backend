import { ApiProperty } from '@nestjs/swagger';

export class RankedLeagueDto {
  id: number;
  name: string;
  iconUrl: string | null;
}

export class RankedRecordDto {
  attackWins: number;
  attackLosses: number;
  defenseWins: number;
  defenseLosses: number;
}

export class RankedClanDto {
  tag: string;
  name: string;
}

export class RankedOpponentDto {
  tag: string;
  name: string;
}

export class RankedGroupMemberDto extends RankedRecordDto {
  rank: number;
  tag: string;
  name: string;
  /** Null when the player isn't in a clan. */
  @ApiProperty({ type: RankedClanDto, nullable: true })
  clan: RankedClanDto | null;
  trophies: number;
}

export class RankedBattleDto {
  opponent: RankedOpponentDto;
  stars: number;
  destruction: number;
  /** Trophies this battle gave the attacker. */
  trophies: number;
  createdAt: Date;
}

export class RankedWeekDto extends RankedRecordDto {
  league: RankedLeagueDto;
  startTime: Date;
  endTime: Date;
  rank: number;
  /** Players in the group. */
  total: number;
  /** The top this many move up a league at the end of the week; 0 when nobody does. */
  promotionZone: number;
  /** The bottom this many move down; 0 when nobody does. */
  demotionZone: number;
  trophies: number;
  /** Attacks allowed this week, and the most defenses taken; null when the game data is unavailable. */
  @ApiProperty({ type: Number, nullable: true })
  maxBattles: number | null;
  /** Standings, best first. */
  members: RankedGroupMemberDto[];
  /** The player's own attacks and defenses, newest first. */
  attacks: RankedBattleDto[];
  defenses: RankedBattleDto[];
}

export class RankedHistoryItemDto extends RankedRecordDto {
  league: RankedLeagueDto;
  startTime: Date;
  placement: number;
  trophies: number;
  defenseStars: number;
  maxBattles: number;
}

export class RankedDto {
  /** This week's group; null when the player isn't in one (between weeks, or unranked). */
  current: RankedWeekDto | null;
  /** Past weeks, newest first. */
  history: RankedHistoryItemDto[];
}
