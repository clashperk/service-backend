import { IsNotEmpty } from 'class-validator';

export class DeleteLinkInput {
  @IsNotEmpty()
  playerTag: string;
}
