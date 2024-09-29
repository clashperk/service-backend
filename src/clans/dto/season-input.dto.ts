import { IsOptional, IsString } from 'class-validator';

export class SeasonInput {
  @IsOptional()
  @IsString()
  season: string;
}
