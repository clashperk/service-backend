import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const nullable = () => ValidateIf((_, value) => value !== null && value !== undefined);

export class ServerLogChannelInput {
  @Matches(/^\d{17,20}$/)
  channelId: string;

  /** From Discord's `webhook.incoming` sign-in; without one, a known webhook in the channel is reused. */
  @ValidateNested()
  @Type(() => ReminderWebhookInput)
  @IsOptional()
  webhook?: ReminderWebhookInput;
}

export class FlagAlertLogInput extends ServerLogChannelInput {
  /** Pinged when a flagged player joins a clan; null for none. */
  @nullable()
  @Matches(/^\d{17,20}$/)
  roleId?: string | null;

  /** Ping each clan's leader and co-leader roles from auto-roles instead of `roleId`. */
  @IsOptional()
  @IsBoolean()
  useAutoRole?: boolean;
}

export class MaintenanceLogInput {
  @Matches(/^\d{17,20}$/)
  channelId: string;
}

export class WelcomeLogInput extends ServerLogChannelInput {
  @Transform(trim)
  @Length(1, 500)
  @Matches(/\{\{user\}\}/, { message: 'The welcome text needs {{user}}.' })
  welcomeText: string;

  @Transform(trim)
  @MaxLength(2000)
  description: string;

  @nullable()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'The banner must be an image link.' },
  )
  @MaxLength(256)
  bannerImage?: string | null;

  /** RGB integer; null uses the bot's default. */
  @nullable()
  @IsInt()
  @Min(0)
  @Max(0xffffff)
  embedColor?: number | null;
}

export class ServerLogChannelDto {
  channelId: string;
  /** Null when the bot can't see the channel any more. */
  channelName: string | null;
}

export class FlagAlertLogDto extends ServerLogChannelDto {
  roleId: string | null;
  useAutoRole: boolean;
}

export class WelcomeLogDto extends ServerLogChannelDto {
  enabled: boolean;
  welcomeText: string;
  description: string;
  bannerImage: string | null;
  embedColor: number | null;
}

/** Each log is null when it isn't set up. */
export class ServerLogsDto {
  flagAlert: FlagAlertLogDto | null;
  rosterChangelog: ServerLogChannelDto | null;
  maintenance: ServerLogChannelDto | null;
  welcome: WelcomeLogDto | null;
}
