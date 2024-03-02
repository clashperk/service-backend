import { IsNotEmpty } from 'class-validator';

export class DeleteLinkInput {
  @IsNotEmpty()
  clanTag: string;

  @IsNotEmpty()
  playerTag: string;
}
