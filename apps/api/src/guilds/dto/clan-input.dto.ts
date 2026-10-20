import { Transform } from 'class-transformer';
import { IsMongoId, IsOptional, Length, Matches } from 'class-validator';

export class AddGuildClanInput {
  /** With or without `#`; the letter O is read as zero, as in the game. */
  @Matches(/^#?[0-9A-Za-z]{3,15}$/, { message: "That isn't a clan tag." })
  tag: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string | null;
}

export class ClanCategoryInput {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 36, { message: 'Category names are 1 to 36 characters.' })
  name: string;
}
