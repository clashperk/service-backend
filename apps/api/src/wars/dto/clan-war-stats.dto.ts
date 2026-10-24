import { NumberString } from '@app/decorators';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, Max, Min } from 'class-validator';
import { ClanWarMemberTotalsDto } from './clan-war-leagues.dto';

export const WAR_STATS_TYPES = ['all', 'regular', 'cwl'] as const;
export type WarStatsType = (typeof WAR_STATS_TYPES)[number];

export class ClanWarStatsInputDto {
  /** Regular and CWL wars, regular only, or CWL only; friendly wars never count. */
  @IsIn(WAR_STATS_TYPES)
  @IsOptional()
  @ApiProperty({ required: false, enum: WAR_STATS_TYPES, default: 'all' })
  type: WarStatsType = 'all';

  /** How many of the latest ended wars to count, for `all` and `regular`. */
  @NumberString(25)
  @Max(100)
  @Min(1)
  @ApiProperty({ required: false, default: 25, minimum: 1, maximum: 100 })
  wars: number = 25;

  /** How many of the latest CWL seasons to count, for `cwl`. */
  @NumberString(3)
  @Max(12)
  @Min(1)
  @ApiProperty({ required: false, default: 3, minimum: 1, maximum: 12 })
  seasons: number = 3;
}

export class ClanWarStatsDto {
  /** Ended wars counted; fewer than asked when the clan has fewer stored. */
  wars: number;

  /** CWL seasons among those wars, newest first. */
  seasons: string[];

  members: ClanWarMemberTotalsDto[];
}
