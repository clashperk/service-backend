import { EnumString } from '@app/decorators';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const nullable = () => ValidateIf((_, value) => value !== null && value !== undefined);
const SNOWFLAKE = /^\d{17,20}$/;
/** A custom emoji `<:name:id>` or a Unicode one, as `/ticket setup` accepts. */
export const EMOJI = /^(<a?:\w{2,32}:\d{17,19}>|[^:]*\p{Extended_Pictographic}[^:]*)$/u;

export enum TicketDisplayMode {
  MENU = 'menu',
  BUTTONS = 'buttons',
}

export enum TicketExtraButtonKind {
  /** Opens the bot's link-account form, with the API token required. */
  LINK_ACCOUNT = 'link-account',
  URL = 'url',
}

export class TicketEmbedInput {
  @nullable()
  @Transform(trim)
  @Length(1, 256)
  title?: string | null;

  @nullable()
  @Transform(trim)
  @Length(1, 2000)
  description?: string | null;

  @nullable()
  @IsInt()
  @Min(1)
  @Max(0xffffff)
  color?: number | null;

  @nullable()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(512)
  imageUrl?: string | null;

  @nullable()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(512)
  thumbnailUrl?: string | null;

  @nullable()
  @Transform(trim)
  @Length(1, 2048)
  footerText?: string | null;
}

export class TicketButtonInput {
  @Transform(trim)
  @Length(1, 80)
  label: string;

  @nullable()
  @Matches(EMOJI, { message: 'Use a Discord emoji or a custom one like <:name:id>.' })
  @MaxLength(56)
  emoji?: string | null;

  /** Discord button style: 1 blue, 2 grey, 3 green, 4 red. */
  @IsInt()
  @Min(1)
  @Max(4)
  style: number;
}

export class TicketLogChannelsInput {
  /** Every click on the panel. */
  @nullable()
  @Matches(SNOWFLAKE)
  buttonClick?: string | null;

  /** Tickets put to sleep, reopened or claimed. */
  @nullable()
  @Matches(SNOWFLAKE)
  statusChange?: string | null;

  /** Closed tickets, with a transcript of the last 100 messages. */
  @nullable()
  @Matches(SNOWFLAKE)
  ticketClose?: string | null;
}

export class TicketExtraButtonInput {
  @EnumString(TicketExtraButtonKind, 'TicketExtraButtonKind')
  kind: TicketExtraButtonKind;

  @Transform(trim)
  @Length(1, 80)
  label: string;

  @nullable()
  @Matches(EMOJI, { message: 'Use a Discord emoji or a custom one like <:name:id>.' })
  @MaxLength(56)
  emoji?: string | null;

  /** Ignored for link buttons, which Discord always shows grey. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  style?: number;

  @ValidateIf((input: TicketExtraButtonInput) => input.kind === TicketExtraButtonKind.URL)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter a full link starting with https://.' },
  )
  @MaxLength(256)
  url?: string;
}

export class CreateTicketPanelInput {
  @Transform(trim)
  @Length(1, 100)
  name: string;
}

/** Only the fields sent change. */
export class TicketPanelInput {
  @IsOptional()
  @Transform(trim)
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TicketEmbedInput)
  embed?: TicketEmbedInput;

  @IsOptional()
  @EnumString(TicketDisplayMode, 'TicketDisplayMode', { required: false })
  displayMode?: TicketDisplayMode;

  @IsOptional()
  @ValidateNested()
  @Type(() => TicketButtonInput)
  button?: TicketButtonInput;

  @IsOptional()
  @ValidateNested()
  @Type(() => TicketLogChannelsInput)
  logChannels?: TicketLogChannelsInput;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TicketExtraButtonInput)
  extraButtons?: TicketExtraButtonInput[];

  /** `row` keeps extra buttons beside the type buttons; `col` starts a new row. */
  @IsOptional()
  @IsIn(['row', 'col'])
  extraButtonsPlacement?: 'row' | 'col';
}

export class TicketQuestionInput {
  /** Discord shows at most 45 characters in the form. */
  @Transform(trim)
  @Length(1, 45)
  label: string;

  @IsBoolean()
  required: boolean;
}

export class CreateTicketTypeInput {
  @Transform(trim)
  @Length(1, 80)
  label: string;

  @nullable()
  @Matches(EMOJI, { message: 'Use a Discord emoji or a custom one like <:name:id>.' })
  @MaxLength(56)
  emoji?: string | null;
}

/** Only the fields sent change; null clears an optional one. */
export class TicketTypeInput {
  @IsOptional()
  @Transform(trim)
  @Length(1, 80)
  label?: string;

  @nullable()
  @Matches(EMOJI, { message: 'Use a Discord emoji or a custom one like <:name:id>.' })
  @MaxLength(56)
  emoji?: string | null;

  /** Used in buttons mode. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  buttonStyle?: number;

  /** Requirements below only apply when this is on. */
  @IsOptional()
  @IsBoolean()
  requireLinkedAccount?: boolean;

  @nullable()
  @IsInt()
  @Min(1)
  @Max(20)
  thMin?: number | null;

  @nullable()
  @IsInt()
  @Min(1)
  @Max(10000)
  minTrophies?: number | null;

  /** 105000013 (Valkyrie League 13) to 105000036 (Legend League). */
  @nullable()
  @Matches(/^1050000(1[3-9]|2\d|3[0-6])$/, { message: 'Pick a league from Valkyrie 13 up.' })
  minLeagueTier?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => TicketQuestionInput)
  questions?: TicketQuestionInput[];

  /** Pinged on new tickets, and staff on them. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(SNOWFLAKE, { each: true })
  pingRoleIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(SNOWFLAKE, { each: true })
  viewOnlyRoleIds?: string[];

  /** Given to the member who opens the ticket. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(SNOWFLAKE, { each: true })
  addRoleIds?: string[];

  /** Taken from the member who opens the ticket. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(SNOWFLAKE, { each: true })
  removeRoleIds?: string[];

  @nullable()
  @Matches(SNOWFLAKE)
  openCategoryId?: string | null;

  @nullable()
  @Matches(SNOWFLAKE)
  sleepCategoryId?: string | null;

  /** `{count}`, `{user}`, `{account_name}` and `{account_th}` are filled in. */
  @IsOptional()
  @Transform(trim)
  @Length(1, 64)
  namingConvention?: string;

  @IsOptional()
  @IsBoolean()
  createStaffThread?: boolean;

  @nullable()
  @IsInt()
  @Min(1)
  @Max(999)
  autoSleepHours?: number | null;

  @IsOptional()
  @IsBoolean()
  allowClaim?: boolean;
}

export class ReorderTicketTypesInput {
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  typeIds: string[];
}

export class TicketSavedReplyInput {
  @Transform(trim)
  @Length(1, 64)
  name: string;

  @Transform(trim)
  @Length(1, 1800)
  content: string;
}

export class TicketSavedRepliesInput {
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => TicketSavedReplyInput)
  savedReplies: TicketSavedReplyInput[];
}

export class TicketQuestionDto {
  label: string;
  required: boolean;
}

export class TicketTypeDto {
  id: string;
  label: string;
  emoji: string | null;
  buttonStyle: number;
  requireLinkedAccount: boolean;
  thMin: number | null;
  minTrophies: number | null;
  minLeagueTier: string | null;
  questions: TicketQuestionDto[];
  pingRoleIds: string[];
  viewOnlyRoleIds: string[];
  addRoleIds: string[];
  removeRoleIds: string[];
  openCategoryId: string | null;
  sleepCategoryId: string | null;
  namingConvention: string;
  createStaffThread: boolean;
  autoSleepHours: number | null;
  allowClaim: boolean;
}

export class TicketEmbedDto {
  title: string | null;
  description: string | null;
  color: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  footerText: string | null;
}

export class TicketButtonDto {
  label: string;
  emoji: string | null;
  style: number;
}

export class TicketLogChannelsDto {
  buttonClick: string | null;
  statusChange: string | null;
  ticketClose: string | null;
}

export class TicketExtraButtonDto {
  id: string;
  @EnumString(TicketExtraButtonKind, 'TicketExtraButtonKind')
  kind: TicketExtraButtonKind;
  label: string;
  emoji: string | null;
  style: number;
  url: string | null;
}

export class TicketPanelDto {
  id: string;
  name: string;
  embed: TicketEmbedDto;
  @EnumString(TicketDisplayMode, 'TicketDisplayMode')
  displayMode: TicketDisplayMode;
  button: TicketButtonDto;
  ticketTypes: TicketTypeDto[];
  logChannels: TicketLogChannelsDto;
  extraButtons: TicketExtraButtonDto[];
  extraButtonsPlacement: string;
  ticketCount: number;
  openTicketCount: number;
  updatedAt: Date;
}

export class TicketSavedReplyDto {
  name: string;
  content: string;
}

export class TicketsDto {
  panels: TicketPanelDto[];
  savedReplies: TicketSavedReplyDto[];
}

export class GuildCategoryDto {
  id: string;
  name: string;
}
