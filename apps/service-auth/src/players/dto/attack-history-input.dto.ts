import { Transform } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

export class AttackHistoryQueryInput {
  @Max(12)
  @Min(1)
  @Transform(({ value }) => Number(value))
  @IsOptional()
  months: number = 12;
}
