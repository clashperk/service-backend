import { ArrayMaxSize, IsNotEmpty, IsString } from 'class-validator';

export class BulkLinksDto {
  @IsString({ each: true })
  @IsNotEmpty()
  @ArrayMaxSize(1000)
  input: string[];
}
