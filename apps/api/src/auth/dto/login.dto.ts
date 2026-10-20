import { EnumArray } from '@app/decorators';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { UserRoles } from './user-roles.dto';

export class LoginInputDto {
  @IsString()
  @IsNotEmpty()
  passKey: string;
}

export class TurnstileLoginDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class GenerateTokenInputDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @EnumArray(UserRoles, 'UserRoles', {
    default: Object.values(UserRoles),
  })
  roles: UserRoles[];
}

export class LoginOkDto {
  @EnumArray(UserRoles, 'UserRoles')
  roles: UserRoles[];

  userId: string;

  accessToken: string;
}

export class GenerateTokenDto {
  @EnumArray(UserRoles, 'UserRoles')
  roles: UserRoles[];

  userId: string;

  accessToken: string;

  passKey: string;

  isBot: boolean;

  displayName: string;
}

export class AuthUserDto {
  @EnumArray(UserRoles, 'UserRoles')
  roles: UserRoles[];

  userId: string;

  displayName: string;

  isBot: boolean;
}

export class HandoffTokenInputDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  guildId: string;

  @IsString()
  @IsOptional()
  applicationId: string | null;
}

export class HandoffTokenDto {
  @IsString()
  token: string;
}

export class HandoffGuildDto {
  id: string;
  name: string;
  iconUrl: string | null;
}

export class HandoffUserDto {
  @EnumArray(UserRoles, 'UserRoles')
  roles: UserRoles[];

  userId: string;

  displayName: string;

  username: string;

  isBot: boolean;

  /** Null when the user can't manage the server, so the dashboard opens without one. */
  guild: HandoffGuildDto | null;

  applicationId: string | null;

  avatarUrl: string | null;
}

export class BotGuildsInputDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  guildIds: string[];
}

export class BotGuildDto extends HandoffGuildDto {
  clanCount: number;
}

export class BotGuildsDto {
  guilds: BotGuildDto[];
}

export class ManagedGuildsInputDto extends BotGuildsInputDto {
  @Matches(/^\d{17,20}$/)
  userId: string;
}

export class GuildAccessInputDto {
  @Matches(/^\d{17,20}$/)
  userId: string;

  @Matches(/^\d{17,20}$/)
  guildId: string;

  /** The custom bot the session came from, if any. */
  @IsOptional()
  @Matches(/^\d{17,20}$/)
  applicationId?: string | null;
}

export class GuildAccessDto {
  /** Owner, Administrator, Manage Server or the bot manager role. */
  canManage: boolean;
}

export class ManagedGuildsDto {
  /** Servers where the user holds one of the bot manager roles. */
  guildIds: string[];
}
