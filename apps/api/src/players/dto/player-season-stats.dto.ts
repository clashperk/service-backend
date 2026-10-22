import { NumberString } from '@app/decorators';
import { ApiProperty } from '@nestjs/swagger';
import { Max, Min } from 'class-validator';

export class PlayerSeasonStatsInputDto {
  @NumberString(2)
  @Max(12)
  @Min(1)
  @ApiProperty({ required: false, default: 2, minimum: 1, maximum: 12 })
  limit: number = 2;
}

export class PlayerSeasonClanStatsDto {
  tag: string;
  name: string;
  donations: number;
  donationsReceived: number;
}

/** Totals for one season; counters are the gain since the season started. */
export class PlayerSeasonStatsDto {
  /** The league season's start date, `YYYY-MM-DD`. */
  season: string;
  townHallLevel: number;
  trophies: number;
  attackWins: number;
  defenseWins: number;
  donations: number;
  donationsReceived: number;
  warStars: number;
  cwlStars: number;
  capitalGold: number;
  clanGamesPoints: number;
  goldLoot: number;
  elixirLoot: number;
  darkElixirLoot: number;
  clans: PlayerSeasonClanStatsDto[];
}

export class PlayerSeasonStatsItemsDto {
  items: PlayerSeasonStatsDto[];
}
