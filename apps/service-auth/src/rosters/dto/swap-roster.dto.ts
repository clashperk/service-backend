import { ObjectIdValidator } from '@app/validators';
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, Validate } from 'class-validator';

export class SwapRosterInput {
  @IsNotEmpty()
  playerTag: string;

  @Validate(ObjectIdValidator)
  rosterId: string;
}

export class SwapRosterBulkInput {
  @Validate(ObjectIdValidator)
  rosterId: string;

  @Validate(ObjectIdValidator)
  @IsOptional()
  categoryId: string | null;

  @IsArray()
  @ArrayMinSize(1)
  playerTags: string[];
}
