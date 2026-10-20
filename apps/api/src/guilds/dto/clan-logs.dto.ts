import { EnumString } from '@app/decorators';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ReminderWebhookInput } from './reminder-input.dto';

/** The log types `/setup clan-logs` offers; the clan embed has its own setup. */
export enum ClanLogType {
  CLAN_ACHIEVEMENTS_LOG = 'clan_achievements_log',
  CONTINUOUS_DONATION_LOG = 'continuous_donation_log',
  DAILY_DONATION_LOG = 'daily_donation_log',
  WEEKLY_DONATION_LOG = 'weekly_donation_log',
  MONTHLY_DONATION_LOG = 'monthly_donation_log',
  CLAN_GAMES_EMBED_LOG = 'clan_games_embed_log',
  LAST_SEEN_EMBED_LOG = 'last_seen_embed_log',
  LEGEND_ATTACKS_DAILY_SUMMARY_LOG = 'legend_attacks_daily_summary_log',

  CLAN_CAPITAL_WEEKLY_SUMMARY_LOG = 'clan_capital_weekly_summary_log',
  CLAN_CAPITAL_CONTRIBUTION_LOG = 'clan_capital_contribution_log',
  CLAN_CAPITAL_RAID_LOG = 'clan_capital_raid_log',

  WAR_ATTACK_LOG = 'war_attack_log',
  CWL_ATTACK_LOG = 'cwl_attack_log',
  WAR_EMBED_LOG = 'war_embed_log',
  WAR_MISSED_ATTACKS_LOG = 'war_missed_attacks_log',
  CWL_EMBED_LOG = 'cwl_embed_log',
  CWL_MISSED_ATTACKS_LOG = 'cwl_missed_attacks_log',
  CWL_LINEUP_CHANGE_LOG = 'cwl_lineup_change_log',
  CWL_MONTHLY_SUMMARY_LOG = 'cwl_monthly_summary_log',

  MEMBER_JOIN_LEAVE_LOG = 'member_join_leave_log',
  ROLE_CHANGE_LOG = 'role_change_log',
  NAME_CHANGE_LOG = 'name_change_log',
  TOWN_HALL_UPGRADE_LOG = 'town_hall_upgrade_log',
  WAR_PREFERENCE_LOG = 'war_preference_log',
  RANKED_BATTLE_LEAGUE_CHANGE_LOG = 'ranked_battle_league_change_log',
}

export class ClanLogInput {
  @Matches(/^\d{17,20}$/)
  channelId: string;

  /** From Discord's `webhook.incoming` sign-in; without one, a known webhook in the channel is reused. */
  @ValidateNested()
  @Type(() => ReminderWebhookInput)
  @IsOptional()
  webhook?: ReminderWebhookInput;

  @IsBoolean()
  isEnabled: boolean;

  /** Pinged with each post; null for none. */
  @Matches(/^\d{17,20}$/)
  @IsOptional()
  roleId: string | null;

  /** Embed color as an RGB integer; null uses the server's default. */
  @IsInt()
  @Min(0)
  @Max(0xffffff)
  @IsOptional()
  color: number | null;
}

/** Whether ClashPerk can post in a log's channel. */
export enum ChannelStatus {
  OK = 'ok',
  /** A thread Discord reopens on the next post. */
  ARCHIVED = 'archived',
  /** A thread only moderators can reopen; posts fail until then. */
  LOCKED = 'locked',
  DELETED = 'deleted',
  NO_ACCESS = 'noAccess',
  /** Discord didn't answer, so the channel couldn't be checked. */
  UNKNOWN = 'unknown',
}

export class ClanLogDto {
  id: string;
  @EnumString(ClanLogType, 'ClanLogType')
  logType: ClanLogType;
  channelId: string;
  channelName: string | null;
  @EnumString(ChannelStatus, 'ChannelStatus')
  channelStatus: ChannelStatus;
  /** The channel a thread is in; null for channels. */
  parentChannelName: string | null;
  isEnabled: boolean;
  roleId: string | null;
  color: number | null;
  updatedAt: Date;
}

/** A clan log with its clan, for listing every log in a server. */
export class GuildClanLogDto extends ClanLogDto {
  clanTag: string;
}

export class ClanLogLimitDto {
  /** How many clans can have logs in this server. */
  limit: number;
  /** Clans that already have logs; adding logs to these never hits the limit. */
  clanTags: string[];
  patron: boolean;
}

/** The fields `/setup clan-embed` can show, in the bot's order. */
export enum ClanEmbedField {
  CLAN_LEADER = 'clanLeader',
  REQUIREMENTS = 'requirements',
  TROPHIES_REQUIRED = 'trophiesRequired',
  LOCATION = 'location',
  WAR_PERFORMANCE = 'warPerformance',
  WAR_FREQUENCY = 'warFrequency',
  CLAN_WAR_LEAGUE = 'clanWarLeague',
  CLAN_CAPITAL_LEAGUE = 'clanCapitalLeague',
  TOWN_HALLS = 'townHalls',
}

export class ClanEmbedInput {
  @Matches(/^\d{17,20}$/)
  channelId: string;

  /** From Discord's `webhook.incoming` sign-in; without one, a known webhook in the channel is reused. */
  @ValidateNested()
  @Type(() => ReminderWebhookInput)
  @IsOptional()
  webhook?: ReminderWebhookInput;

  /** Embed color as an RGB integer; null uses the server's default. */
  @IsInt()
  @Min(0)
  @Max(0xffffff)
  @IsOptional()
  color?: number | null;

  /** Null shows the in-game clan description. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 1200)
  description?: string | null;

  /** Null shows the in-game Town Hall requirement. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 600)
  requirements?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(256)
  bannerImage?: string | null;

  @IsArray()
  @ArrayMaxSize(9)
  @IsEnum(ClanEmbedField, { each: true })
  @ApiProperty({ enum: ClanEmbedField, enumName: 'ClanEmbedField', isArray: true })
  fields: ClanEmbedField[];
}

export class ClanEmbedDto {
  channelId: string;
  channelName: string | null;
  color: number | null;
  /** Null when it shows the in-game clan description. */
  description: string | null;
  /** Null when it shows the in-game Town Hall requirement. */
  requirements: string | null;
  bannerImage: string | null;
  @ApiProperty({ enum: ClanEmbedField, enumName: 'ClanEmbedField', isArray: true })
  fields: ClanEmbedField[];
  /** The posted message, once the bot has sent it. */
  messageId: string | null;
  updatedAt: Date;
}

export class ClanEmbedStateDto {
  /** Null when the clan has no embed. */
  embed: ClanEmbedDto | null;
}
