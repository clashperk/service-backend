import { EnumArray } from '@app/decorators';
import { IsString } from 'class-validator';
import { UserRoles } from './user-roles.dto';

export class LoginInputDto {
  @IsString()
  passKey: string;
}

export class GenerateTokenInputDto {
  @IsString()
  userId: string;

  @EnumArray(UserRoles, 'UserRoles')
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
  userId: string;

  @IsString()
  guildId: string;
}

export class HandoffUserDto {
  @EnumArray(UserRoles, 'UserRoles')
  roles: UserRoles[];

  userId: string;

  displayName: string;

  isBot: boolean;

  avatarUrl: string | null;
}
