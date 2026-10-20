import { EnumString } from '@app/decorators';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { RostersEntity } from '../../db';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const nullable = () => ValidateIf((_, value) => value !== null && value !== undefined);

/** The roster kinds `/roster create` offers. */
export enum RosterCategory {
  GENERAL = 'GENERAL',
  CWL = 'CWL',
  WAR = 'WAR',
  TROPHY = 'TROPHY',
}

export enum RosterSortBy {
  PLAYER_NAME = 'PLAYER_NAME',
  DISCORD_NAME = 'DISCORD_NAME',
  DISCORD_USERNAME = 'DISCORD_USERNAME',
  TOWN_HALL_LEVEL = 'TOWN_HALL_LEVEL',
  HERO_LEVEL = 'HERO_LEVEL',
  TH_HERO_LEVEL = 'TH_HERO_LEVEL',
  CLAN_NAME = 'CLAN_NAME',
  SIGNUP_TIME = 'SIGNUP_TIME',
  TROPHIES = 'TROPHIES',
  LEAGUES = 'LEAGUES',
}

/** Columns of the posted roster, as `rosterLayoutMap` in the bot names them. */
export const ROSTER_LAYOUT_KEYS = [
  '#',
  'TH',
  'TH_ICON',
  'DISCORD',
  'USERNAME',
  'DISCORD_ID',
  'NAME',
  'TAG',
  'CLAN',
  'HERO_LEVEL',
  'ROLE',
  'PREF',
  'TROPHIES',
  'LEAGUE_ICONS',
];

/** Everything `/roster create` takes; unset fields fall back to the server's last-used settings. */
export class RosterInput {
  @Transform(trim)
  @Length(1, 30, { message: 'Roster names are 1 to 30 characters.' })
  name: string;

  /** Leave out for a roster open to all clans. */
  @IsOptional()
  @IsString()
  clanTag?: string | null;

  @IsOptional()
  @EnumString(RosterCategory, 'RosterCategory', { required: false })
  category?: RosterCategory;

  /** Sign up the clan's current members when the roster is created. */
  @IsOptional()
  @IsBoolean()
  importMembers?: boolean;

  @IsOptional()
  @IsBoolean()
  allowUnlinked?: boolean;
  @IsOptional()
  @IsBoolean()
  allowMultiSignup?: boolean;
  @IsOptional()
  @IsBoolean()
  allowCategorySelection?: boolean;
  @IsOptional()
  @IsBoolean()
  requireCategorySelection?: boolean;
  @nullable()
  @Transform(trim)
  @Length(1, 100)
  categorySelectionCustomText?: string | null;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(500)
  maxMembers?: number;
  @nullable()
  @IsInt()
  @Min(1)
  @Max(75)
  maxAccountsPerUser?: number | null;
  @nullable()
  @IsInt()
  @Min(2)
  @Max(18)
  minTownHall?: number | null;
  @nullable()
  @IsInt()
  @Min(2)
  @Max(18)
  maxTownHall?: number | null;
  @nullable()
  @IsInt()
  @Min(0)
  minHeroLevels?: number | null;

  @nullable()
  @Matches(/^\d{17,20}$/)
  roleId?: string | null;

  @IsOptional()
  @EnumString(RosterSortBy, 'RosterSortBy', { required: false })
  sortBy?: RosterSortBy;
  /** 3 to 5 column keys joined by "/", e.g. "#/TH_ICON/DISCORD/NAME/CLAN". */
  @IsOptional()
  @IsString()
  layout?: string;
  @IsOptional()
  @IsBoolean()
  useClanAlias?: boolean;
  @nullable()
  @IsInt()
  @Min(0)
  @Max(0xffffff)
  colorCode?: number | null;
  @nullable()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  rosterImage?: string | null;

  /** ISO time; null opens sign-ups right away. */
  @nullable()
  @IsDateString()
  startTime?: string | null;
  /** ISO time; null keeps sign-ups open until closed by hand. */
  @nullable()
  @IsDateString()
  endTime?: string | null;
}

/** Only the fields sent change; `closed` opens or closes sign-ups. */
export class RosterUpdateInput extends PartialType(RosterInput) {
  @IsOptional()
  @IsBoolean()
  closed?: boolean;
}

export class CloneRosterInput {
  /** Defaults to "<name> [CLONE]". */
  @IsOptional()
  @Transform(trim)
  @Length(1, 30)
  name?: string;
}

export class RosterTagsInput {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  playerTags: string[];
}

export class AddRosterMembersInput extends RosterTagsInput {
  @IsOptional()
  @IsMongoId()
  groupId?: string | null;
}

export class RosterCheckUserDto {
  id: string;
  username: string;
  displayName: string;
}

export class RosterPlayerCheckDto {
  tag: string;
  /** Null when no player has this tag. */
  name: string | null;
  townHallLevel: number | null;
  heroLevels: number | null;
  clanRole: string | null;
  /** The linked Discord member, if any. */
  user: RosterCheckUserDto | null;
  canJoin: boolean;
  /** Why the player can't join, in the bot's words. */
  reason: string | null;
}

export class AddRosterMembersDto {
  roster: RostersEntity;
  result: RosterPlayerCheckDto[];
}

export class RosterGroupInput {
  @Transform(trim)
  @Length(1, 30, { message: 'Group names are 1 to 30 characters.' })
  name: string;
  @nullable()
  @Matches(/^\d{17,20}$/)
  roleId?: string | null;
  /** Players can pick it when they sign up. */
  @IsOptional()
  @IsBoolean()
  selectable?: boolean;
}

export class RosterGroupUpdateInput extends PartialType(RosterGroupInput) {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @ApiProperty({ required: false })
  order?: number;
}
