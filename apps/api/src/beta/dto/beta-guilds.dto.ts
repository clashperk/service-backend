import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class AddBetaGuildsInput {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Matches(/^\d{17,20}$/, { each: true, message: 'Each server ID is 17 to 20 digits.' })
  guildIds: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 200)
  note?: string | null;
}

export class BetaGuildDto {
  guildId: string;
  /** Null when ClashPerk isn't in the server. */
  name: string | null;
  iconUrl: string | null;
  note: string | null;
  addedBy: string;
  createdAt: Date;
}

export class BetaGuildsDto {
  guilds: BetaGuildDto[];
}

export class BetaGuildIdsDto {
  guildIds: string[];
}

export class GuildBetaDto {
  beta: boolean;
}
