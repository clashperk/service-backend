import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { UserRoles } from './roles.dto';

export class LoginInputDto {
  @IsString()
  token: string;
}

export class LoginOkDto {
  @ApiProperty({ isArray: true, enum: UserRoles, enumName: 'UserRoles' })
  roles: UserRoles[];

  userId: string;
  accessToken: string;
}
