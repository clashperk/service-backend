import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';
import { LegendRankingThresholdsSnapShotDto } from '../../tasks/dto';

export class LegendRankingThresholdsDto {
  live: LegendRankingThresholdsSnapShotDto;
  eod: LegendRankingThresholdsSnapShotDto | null;
  history: LegendRankingThresholdsSnapShotDto[];
}

export class LeaderboardByTagsInputDto {
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @ArrayMinSize(0)
  @ApiProperty({ example: ['#2PP'] })
  playerTags: string[];

  @IsInt()
  @IsNotEmpty()
  @ValidateIf((o) => !o.playerTags?.length)
  @ApiProperty({ example: 1 })
  minRank: number;

  @IsInt()
  @IsNotEmpty()
  @ValidateIf((o) => !o.playerTags?.length)
  @ApiProperty({ example: 100 })
  maxRank: number;
}

export class LeaderboardByTagsDto {
  tag: string;
  name: string;
  rank: number;
  trophies: number;
}

export class LeaderboardByTagsItemsDto {
  items: LeaderboardByTagsDto[];
}
