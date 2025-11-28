import { EnumArray } from '@app/decorators';
import { IsNotEmpty, IsString } from 'class-validator';
import { UserRoles } from './user-roles.dto';

export class LoginInputDto {
  @IsString()
  @IsNotEmpty()
  passKey: string;
}

export class GenerateTokenInputDto {
  @IsString()
  @IsNotEmpty()
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
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  guildId: string;
}

export class HandoffUserDto {
  @EnumArray(UserRoles, 'UserRoles')
  roles: UserRoles[];

  userId: string;

  displayName: string;

  username: string;

  isBot: boolean;

  avatarUrl: string | null;
}
