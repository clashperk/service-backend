import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const CLAN_ROLES = ['leader', 'coLeader', 'admin', 'member'] as const;
export const WAR_TYPES = ['normal', 'friendly', 'cwl'] as const;

/** The bot's limits per type: at least 15 minutes, in 15-minute steps. */
export const DURATION_LIMITS = {
  clanWars: 48 * HOUR,
  capitalRaids: 3 * 24 * HOUR,
  clanGames: 6 * 24 * HOUR,
} as const;
export const DURATION_STEP = 15 * MINUTE;

export class ReminderWebhookInput {
  @Matches(/^\d{17,20}$/)
  id: string;

  @IsString()
  @MinLength(1)
  token: string;
}

class ReminderBaseInput {
  @Matches(/^\d{17,20}$/)
  channelId: string;

  /** From Discord's `webhook.incoming` sign-in; without one, a known webhook in the channel is reused. */
  @ValidateNested()
  @Type(() => ReminderWebhookInput)
  @IsOptional()
  webhook?: ReminderWebhookInput;

  @IsString()
  @MinLength(1)
  @MaxLength(1800)
  message: string;

  /** Time before the event ends, in milliseconds. */
  @IsInt()
  @Min(DURATION_STEP)
  duration: number;

  @IsArray()
  @ArrayUnique()
  @IsIn(CLAN_ROLES, { each: true })
  @ApiProperty({ enum: CLAN_ROLES, isArray: true })
  roles: string[];

  @IsBoolean()
  linkedOnly: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Matches(/^#[0289PYLQGRJCUV]{3,}$/, { each: true })
  clans: string[];
}

export class ClanWarReminderInput extends ReminderBaseInput {
  @IsBoolean()
  disabled: boolean;

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(18, { each: true })
  townHalls: number[];

  /** Ping members with this many attacks left; empty pings nobody. */
  @IsArray()
  @ArrayUnique()
  @IsIn([1, 2], { each: true })
  remaining: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(WAR_TYPES, { each: true })
  @ApiProperty({ enum: WAR_TYPES, isArray: true })
  warTypes: string[];

  /** Skip once the clan reaches 100% destruction. */
  @IsBoolean()
  smartSkip: boolean;

  /** Post the message only, without mentioning members. */
  @IsBoolean()
  silent: boolean;
}

export class CapitalRaidReminderInput extends ReminderBaseInput {
  @IsBoolean()
  allMembers: boolean;

  @IsInt()
  @Min(0)
  @Max(6)
  minThreshold: number;

  @IsArray()
  @ArrayUnique()
  @IsIn([1, 2, 3, 4, 5, 6], { each: true })
  remaining: number[];
}

export class ClanGamesReminderInput extends ReminderBaseInput {
  @IsBoolean()
  allMembers: boolean;

  @IsInt()
  @Min(0)
  @Max(10000)
  minPoints: number;
}

export class GuildChannelDto {
  id: string;
  name: string;
  /** Discord channel type: 0 text, 5 announcement. */
  type: number;
  parentId: string | null;
  position: number;
  /** ClashPerk already has a webhook here, so a reminder needs no Discord sign-in. */
  hasWebhook: boolean;
}

export class GuildRoleDto {
  id: string;
  name: string;
  color: number;
  position: number;
}

export class ReminderIdDto {
  id: string;
}
