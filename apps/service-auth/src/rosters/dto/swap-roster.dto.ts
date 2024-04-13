import { ObjectIdValidator } from '@app/validators';
import { IsNotEmpty, Validate } from 'class-validator';

export class SwapRosterInput {
  @IsNotEmpty()
  playerTag: string;

  @Validate(ObjectIdValidator)
  rosterId: string;
}
