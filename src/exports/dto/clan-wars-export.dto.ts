import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class ClanWarsExportInput {
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  clanTags: string[];

  @IsString()
  guildId: string;

  @IsNumber()
  limit: number;

  @IsDate()
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  startDate: Date | null;

  @IsString()
  warType: 'regular' | 'cwl' | 'friendly' | 'regular-and-cwl' | string;
}
