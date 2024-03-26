import { Transform } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

export class PaginationInput {
  @Max(60)
  @Min(1)
  @Transform(({ value }) => Number(value))
  @IsOptional()
  limit: number = 5;
}
