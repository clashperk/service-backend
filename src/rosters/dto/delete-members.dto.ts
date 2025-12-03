import { ArrayMinSize, IsArray } from 'class-validator';

export class RemoveMembersBulkInput {
  @IsArray()
  @ArrayMinSize(1)
  playerTags: string[];
}
