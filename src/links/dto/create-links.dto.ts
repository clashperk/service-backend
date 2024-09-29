import { IsNotEmpty } from 'class-validator';

export class CreateLinkInput {
  @IsNotEmpty()
  playerTag: string;

  @IsNotEmpty()
  userId: string;
}
