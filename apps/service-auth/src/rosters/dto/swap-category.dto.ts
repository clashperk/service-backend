import { ObjectIdValidator } from '@app/validators';
import { IsNotEmpty, Validate } from 'class-validator';

export class SwapCategoryInput {
  @IsNotEmpty()
  playerTag: string;

  @Validate(ObjectIdValidator)
  categoryId: string;
}
