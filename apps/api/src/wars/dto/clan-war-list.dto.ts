import { ClanBadge } from '@app/clash-client/dto';
import { DateTime, EnumString, NumberString } from '@app/decorators';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, Max, Min } from 'class-validator';
import { WarTypes } from '../../players/dto/war-types.enum';

export class ClanWarListInputDto {
  @NumberString(20)
  @Max(50)
  @Min(1)
  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 50 })
  limit: number = 20;

  /** Only wars that started before this; pass the previous page's `next`. */
  @DateTime()
  @IsOptional()
  @ApiProperty({ required: false })
  before?: number;
}

export class ClanWarSideDto {
  tag: string;
  name: string;
  badgeUrls: ClanBadge;
  clanLevel: number;
  attacks: number;
  stars: number;
  destructionPercentage: number;
}

export class ClanWarSummaryDto {
  id: number;

  @EnumString(WarTypes, 'WarTypes')
  warType: WarTypes;

  @ApiProperty({ type: 'string' })
  state: 'preparation' | 'inWar' | 'warEnded';

  teamSize: number;

  attacksPerMember: number;

  @ApiProperty({ type: String, format: 'date-time' })
  preparationStartTime: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  startTime: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  endTime: Date;

  /** Set for CWL rounds only. */
  @ApiProperty({ type: 'string', nullable: true })
  warTag: string | null;

  /** From the requested clan's side; "tie" while a war is still running and level. */
  @ApiProperty({ type: 'string' })
  result: 'win' | 'lose' | 'tie';

  clan: ClanWarSideDto;
  opponent: ClanWarSideDto;
}

export class ClanWarListDto {
  items: ClanWarSummaryDto[];

  /** Pass as `before` for the next page; null on the last page. */
  @ApiProperty({ type: 'number', nullable: true })
  next: number | null;
}
