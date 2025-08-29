import { EnumArray } from '@app/decorators';
import { IsString } from 'class-validator';
import { UserRoles } from './roles.dto';

export class LoginInputDto {
  @IsString()
  userId: string;
}

export class GenerateTokenInputDto extends LoginInputDto {
  @EnumArray(UserRoles, 'UserRoles')
  roles: UserRoles[];
}

export class LoginOkDto {
  @EnumArray(UserRoles, 'UserRoles')
  roles: UserRoles[];

  userId: string;
}

export class GenerateTokenDto extends LoginOkDto {
  accessToken: string;
}
