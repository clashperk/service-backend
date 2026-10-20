import { EnumArray, EnumString } from '@app/decorators';
import { ApiProperty, ApiPropertyOptional, ApiPropertyOptions } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  MaxLength,
  ValidateNested,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

const roleMap: ApiPropertyOptions = { type: 'object', additionalProperties: { type: 'string' } };

/** The role groups a role delay can skip, as `/autorole config` names them. */
export enum DelayExclusion {
  TOWN_HALL_ROLES = 'townHallRoles',
  BUILDER_HALL_ROLES = 'builderHallRoles',
  LEAGUE_ROLES = 'leagueRoles',
  BUILDER_LEAGUE_ROLES = 'builderLeagueRoles',
  GUEST_ROLE = 'guestRole',
}

const HOUR = 60 * 60 * 1000;
export const REMOVAL_DELAYS = [0, 1, 2, 4, 6, 8, 12, 18, 24, 36, 48, 72, 168, 288].map(
  (hours) => hours * HOUR,
);
export const ADDITION_DELAYS = REMOVAL_DELAYS.filter((delay) => delay <= 24 * HOUR);

/** Which linked account a nickname is built from. */
export enum NicknameAccount {
  DEFAULT = 'default-account',
  BEST = 'best-account',
  DEFAULT_OR_BEST = 'default-or-best-account',
}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Short labels for `{ROLE}`; blank uses the bot's default (Lead, Co-Lead, Eld, Mem). */
export class NicknameRoleLabels {
  @Transform(trim)
  @MaxLength(10)
  leader: string;
  @Transform(trim)
  @MaxLength(10)
  coLeader: string;
  @Transform(trim)
  @MaxLength(10)
  elder: string;
  @Transform(trim)
  @MaxLength(10)
  member: string;
}

export class AutoRoleClanDto {
  tag: string;
  name: string;
  leader: string | null;
  coLeader: string | null;
  elder: string | null;
  member: string | null;
  everyone: string | null;
  warRole: string | null;
}

/** Each map is keyed as the bot keys it: Town Hall or Builder Hall level, league name, trophy range. */
export class AutoRolesDto {
  @ApiProperty(roleMap)
  townHall: Record<string, string>;
  @ApiProperty(roleMap)
  builderHall: Record<string, string>;
  @ApiProperty(roleMap)
  leagues: Record<string, string>;
  @ApiProperty(roleMap)
  builderLeagues: Record<string, string>;
  @ApiProperty(roleMap)
  trophies: Record<string, string>;

  familyRole: string | null;
  exclusiveFamilyRole: string | null;
  familyLeadersRoles: string[];
  guestRole: string | null;
  verifiedRole: string | null;
  linkedRole: string | null;

  eosPushRole: string | null;
  eosPushClans: string[];

  /** Town Hall and Builder Hall roles also go to accounts outside the server's clans. */
  allowNonFamilyTownHall: boolean;
  /** League and builder league roles also go to accounts outside the server's clans. */
  allowNonFamilyLeagues: boolean;
  verifiedOnlyClanRoles: boolean;
  autoUpdate: boolean;
  forceRefresh: boolean;
  /** Members with no linked account still get roles like the guest role. */
  allowNotLinked: boolean;
  /** Milliseconds; one of the bot's choices. */
  removalDelay: number;
  additionDelay: number;
  @EnumArray(DelayExclusion, 'DelayExclusion')
  delayExclusions: DelayExclusion[];

  clans: AutoRoleClanDto[];

  /** Nickname format for members in your clans; "" means none. */
  familyNicknameFormat: string;
  /** Nickname format for everyone else; "" means none. */
  nonFamilyNicknameFormat: string;
  /** Nicknames change on the bot's checks, not only on a refresh. */
  autoNickname: boolean;
  @EnumString(NicknameAccount, 'NicknameAccount')
  nicknameAccount: NicknameAccount;
  nicknameRoleLabels: NicknameRoleLabels;
}

const OptionalRole = () => ValidateIf((_, value) => value !== null && value !== undefined);

/** Only the fields sent are saved; each replaces what's stored. An empty map or null turns it off. */
export class AutoRolesInput {
  @IsOptional()
  @IsObject()
  @ApiPropertyOptional(roleMap)
  townHall?: Record<string, string>;
  @IsOptional()
  @IsObject()
  @ApiPropertyOptional(roleMap)
  builderHall?: Record<string, string>;
  @IsOptional()
  @IsObject()
  @ApiPropertyOptional(roleMap)
  leagues?: Record<string, string>;
  @IsOptional()
  @IsObject()
  @ApiPropertyOptional(roleMap)
  builderLeagues?: Record<string, string>;
  @IsOptional()
  @IsObject()
  @ApiPropertyOptional(roleMap)
  trophies?: Record<string, string>;

  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  familyRole?: string | null;
  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  exclusiveFamilyRole?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @Matches(/^\d{17,20}$/, { each: true })
  familyLeadersRoles?: string[];
  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  guestRole?: string | null;
  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  verifiedRole?: string | null;
  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  linkedRole?: string | null;

  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  eosPushRole?: string | null;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eosPushClans?: string[];

  @IsOptional()
  @IsBoolean()
  allowNonFamilyTownHall?: boolean;
  @IsOptional()
  @IsBoolean()
  allowNonFamilyLeagues?: boolean;
  @IsOptional()
  @IsBoolean()
  verifiedOnlyClanRoles?: boolean;
  @IsOptional()
  @IsBoolean()
  autoUpdate?: boolean;
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
  @IsOptional()
  @IsBoolean()
  allowNotLinked?: boolean;
  @IsOptional()
  @IsIn(REMOVAL_DELAYS, { message: 'Pick one of the removal delays the bot offers.' })
  removalDelay?: number;
  @IsOptional()
  @IsIn(ADDITION_DELAYS, { message: 'Pick one of the addition delays the bot offers.' })
  additionDelay?: number;
  @IsOptional()
  @EnumArray(DelayExclusion, 'DelayExclusion', { required: false })
  delayExclusions?: DelayExclusion[];

  @IsOptional()
  @Transform(trim)
  @MaxLength(100)
  familyNicknameFormat?: string;
  @IsOptional()
  @Transform(trim)
  @MaxLength(100)
  nonFamilyNicknameFormat?: string;
  @IsOptional()
  @IsBoolean()
  autoNickname?: boolean;
  @IsOptional()
  @EnumString(NicknameAccount, 'NicknameAccount', { required: false })
  nicknameAccount?: NicknameAccount;
  @IsOptional()
  @ValidateNested()
  @Type(() => NicknameRoleLabels)
  nicknameRoleLabels?: NicknameRoleLabels;
}

/** A clan's roles by in-game rank, plus its in-war role; null turns one off. */
export class AutoRoleClanInput {
  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  leader: string | null;
  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  coLeader: string | null;
  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  elder: string | null;
  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  member: string | null;
  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  everyone: string | null;
  @OptionalRole()
  @Matches(/^\d{17,20}$/)
  warRole: string | null;
}
