import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsString } from 'class-validator';

export class GetLegendAttacksInputDto {
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  @ApiProperty({ example: ['#2PP'] })
  playerTags: string[];
}

export class LegendAttackLogDto {
  timestamp: number;
  start: number;
  end: number;
  diff: number;
  type: string;
}

export class LegendAttacksDto {
  tag: string;
  name: string;
  seasonId: string;
  trophies: number;
  logs: LegendAttackLogDto[];
}

export class LegendAttacksItemsDto {
  items: LegendAttacksDto[];
}
