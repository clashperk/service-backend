import { ArrayMaxSize, IsString } from 'class-validator';

export class BulkLinksDto {
  @IsString({ each: true })
  @ArrayMaxSize(1000)
  input: string[];
}
