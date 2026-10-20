import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsMongoId,
  IsOptional,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

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

const nullable = () => ValidateIf((_, value) => value !== null && value !== undefined);

/** Only the fields sent change; null or an empty list clears one. */
export class ClanSettingsInput {
  /** Up to 15 characters, no spaces or leading #. */
  @nullable()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^#\s]\S{0,14}$/, {
    message: 'An alias is up to 15 characters, with no spaces and no # at the start.',
  })
  alias?: string | null;

  @nullable()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 15, { message: 'A short name is 1 to 15 characters.' })
  nickname?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @Matches(/^\d{17,20}$/, { each: true })
  channels?: string[];
}
