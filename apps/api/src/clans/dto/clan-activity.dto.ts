import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ClanActivityInputDto {
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @ArrayMinSize(1)
  @ApiProperty({ example: ['#2L2YLJV2C'] })
  clanTags: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  @ApiProperty({ required: false, default: 7, minimum: 1, maximum: 30 })
  days: number = 7;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiProperty({ required: false, default: 50, minimum: 1, maximum: 100 })
  limit: number = 50;
}

export const CLAN_ACTIVITY_TYPES = [
  'town_hall_upgrade',
  'joined',
  'left',
  'clan_level_up',
  'capital_hall_level_up',
  'war_league_change',
  'capital_league_change',
] as const;

export type ClanActivityType = (typeof CLAN_ACTIVITY_TYPES)[number];

export class ClanActivityPlayerDto {
  tag: string;
  name: string;
}

export class ClanActivityClanDto {
  tag: string;
  name: string;
}

export class ClanActivityItemDto {
  @ApiProperty({ enum: CLAN_ACTIVITY_TYPES })
  type: ClanActivityType;

  createdAt: Date;
  clan: ClanActivityClanDto;

  /** Who it happened to; null for clan-wide events. */
  @ApiProperty({ type: () => ClanActivityPlayerDto, nullable: true })
  player: ClanActivityPlayerDto | null;

  /** The new Town Hall, clan or Capital Hall level; null otherwise. */
  @ApiProperty({ type: 'number', nullable: true })
  level: number | null;

  /** The new war or capital league; null otherwise. */
  @ApiProperty({ type: 'string', nullable: true })
  league: string | null;
}

export class ClanActivityDto {
  /** Newest first. */
  items: ClanActivityItemDto[];
}
