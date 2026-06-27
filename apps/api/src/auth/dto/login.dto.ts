import { EnumArray } from '@app/decorators';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
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

  guild: HandoffGuildDto;

  applicationId: string | null;

  avatarUrl: string | null;
}
