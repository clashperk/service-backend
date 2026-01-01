import { ArrayMaxSize, ArrayMinSize, IsString } from 'class-validator';

export class ExportMembersInput {
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  clanTags: string[];
}
