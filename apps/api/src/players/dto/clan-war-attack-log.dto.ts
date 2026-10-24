import { DateTime, EnumString, NumberString } from '@app/decorators';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, Max, Min } from 'class-validator';
import { WarTypes } from './war-types.enum';

export class AttackHistoryInputDto {
  @DateTime()
  startDate: number;
}

export class PlayerWarsInputDto {
  /** The newest wars first, at most this many. */
  @NumberString(50)
  @Max(100)
  @Min(1)
  @ApiProperty({ required: false, default: 50, minimum: 1, maximum: 100 })
  limit: number = 50;

  /** Only wars that started on or after this. */
  @DateTime()
  @IsOptional()
  @ApiProperty({ required: false })
  startDate?: number;
}

class AttackRecordDto {
  stars: number;
  trueStars: number;
  defenderTag: string;
  destruction: number;

  @ApiProperty()
  defender: {
    tag: string;
    townHallLevel: number;
    mapPosition: number;
  };
}

export class AttackHistoryDto {
  season: string;

  id: number;

  @EnumString(WarTypes, 'WarTypes')
  warType: WarTypes;

  @ApiProperty({ type: String, format: 'date-time' })
  startTime: string | Date;

  @ApiProperty({ type: String, format: 'date-time' })
  endTime: string | Date;

  clan: {
    name: string;
    tag: string;
  };
  opponent: {
    name: string;
    tag: string;
  };
  attacker: {
    name: string;
    tag: string;
    townHallLevel: number;
    mapPosition: number;
  };
  attacksPerMember: number;
  teamSize: number;

  @ApiProperty({ isArray: true, type: AttackRecordDto })
  attacks: AttackRecordDto[];
}

export class AttackHistoryItemsDto {
  items: AttackHistoryDto[];
}

export class AggregateAttackHistoryDto {
  season: string;
  totalWars: number;
  totalAttacks: number;
  total3Stars: number;
  totalMissed: number;
  totalStars: number;
}

export class AggregateAttackHistoryItemsDto {
  items: AggregateAttackHistoryDto[];
}

/** The player's rounds in one CWL group: a season played in two clans is two of these. */
export class AggregateClanWarLeagueHistoryDto {
  season: string;

  @ApiProperty()
  clan: { tag: string; name: string };

  /** The clan's war league in that group; null when the group wasn't stored. */
  @ApiProperty({ type: 'number', nullable: true })
  leagueId: number | null;

  /** Rounds the player was in the lineup for. */
  wars: number;
  attacks: number;
  /** Attacks left unused in ended rounds. */
  missed: number;
  stars: number;
  threeStars: number;
  /** Sum over attacks; divide by `attacks` for the average. */
  destruction: number;
}

export class AggregateClanWarLeagueHistoryItemsDto {
  items: AggregateClanWarLeagueHistoryDto[];
}
