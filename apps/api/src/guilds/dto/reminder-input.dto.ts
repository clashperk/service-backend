import { EnumArray } from '@app/decorators';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
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

export const ReminderClanRole = {
  leader: 'leader',
  coLeader: 'coLeader',
  admin: 'admin',
  member: 'member',
} as const;
export const ReminderWarType = { normal: 'normal', friendly: 'friendly', cwl: 'cwl' } as const;
const WarAttacksLeft = { one: 1, two: 2 } as const;
const RaidAttacksLeft = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 } as const;

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
  @EnumArray(ReminderClanRole, 'ReminderClanRole')
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
  @EnumArray(WarAttacksLeft, 'WarAttacksLeft')
  remaining: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @EnumArray(ReminderWarType, 'ReminderWarType')
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
  @EnumArray(RaidAttacksLeft, 'RaidAttacksLeft')
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
  /** Discord channel type: 0 text, 5 announcement, 15 forum, 16 media; 10, 11, 12 threads. */
  type: number;
  /** A channel's category, or a thread's channel. */
  parentId: string | null;
  /** False for a forum or media channel, which is listed only as the heading of its posts. */
  selectable: boolean;
  /** ClashPerk already has a webhook here (a thread's is its channel's), so no Discord sign-in is needed. */
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
