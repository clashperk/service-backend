import { ArrayMaxSize, ArrayMinSize, IsString } from 'class-validator';

export class BulkLinksInput {
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  input: string[];
}
