import { EnumString } from '@app/decorators';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export enum FlagType {
  BAN = 'ban',
  STRIKE = 'strike',
}

export class FlagAuthorDto {
  id: string;
  username: string;
  displayName: string;
}

export class FlagDto {
  id: string;
  /** The short reference the bot shows, e.g. in `/flag delete`. */
  refId: string;
  @EnumString(FlagType, 'FlagType')
  flagType: FlagType;
  tag: string;
  name: string;
  /** Strike points; 1 unless set. */
  flagImpact: number;
  reason: string;
  /** Null when it never expires. */
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: FlagAuthorDto;
}

export class FlagsDto {
  /** Active flags, newest first. */
  items: FlagDto[];
  /** Active flags of both types, against the limit. */
  total: number;
  /** Null for supporter servers, which have no limit. */
  limit: number | null;
}

export class FlagInput {
  @EnumString(FlagType, 'FlagType')
  flagType: FlagType;

  /** One or more player tags; the bot's option fits about 25. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsString({ each: true })
  playerTags: string[];

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 256, { message: 'Reasons are 1 to 256 characters.' })
  reason: string;

  /** Leave out for a flag that never expires. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36500)
  expiresInDays?: number | null;

  /** Strike points, 1 to 100; defaults to 1. The bot stores it for bans too. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  flagImpact?: number;
}
