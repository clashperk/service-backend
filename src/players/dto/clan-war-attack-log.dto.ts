import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

export class AttackHistoryInputDto {
  @Max(12)
  @Min(1)
  @Transform(({ value }) => Number(value))
  @IsOptional()
  months: number = 12;
}

class AttackRecordDto {
  stars: number;
  trueStars: number;
  defenderTag: string;
  destructionPercentage: number;

  @ApiProperty()
  defender: {
    tag: string;
    townHallLevel: number;
    mapPosition: number;
  };
}

export class AttackHistoryDto {
  id: number;
  warType: number;
  startTime: string | Date;
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

  @ApiProperty({ isArray: true, type: AttackRecordDto })
  attacks: AttackRecordDto[];
}
