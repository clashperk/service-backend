import { ObjectIdValidator } from '@app/validators';
import { ArrayMinSize, IsArray, IsNotEmpty, Validate } from 'class-validator';

export class SwapCategoryInput {
  @IsNotEmpty()
  playerTag: string;

  @Validate(ObjectIdValidator)
  categoryId: string;
}

export class SwapCategoryBulkInput {
  @Validate(ObjectIdValidator)
  categoryId: string;

  @IsArray()
  @ArrayMinSize(1)
  playerTags: string[];
}
