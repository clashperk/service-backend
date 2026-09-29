import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class CapitalContributionInputDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @ApiProperty({ required: false, example: '2026-09-25' })
  season?: string;
}

export class CapitalContributionClanDto {
  name: string;
  tag: string;
}

export class CapitalContributionItemDto {
  name: string;
  tag: string;
  season: string;
  initial: number;
  current: number;
  clan: CapitalContributionClanDto;
  createdAt: Date;
}

export class CapitalContributionDto {
  items: CapitalContributionItemDto[];
}
