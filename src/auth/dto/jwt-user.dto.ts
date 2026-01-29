import { ApiProperty } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { UserRoles } from './user-roles.dto';

export class JwtUserInput {
  jti: string;
  userId: string;
  username: string;
  version: string;
  @ApiProperty({ type: 'array', items: { type: 'string' } })
  roles: UserRoles[];
  guildIds: string[];
  applicationId?: string;
  remoteIp?: string;
  cacheMultiplier?: number;
}

export class JwtUser implements JwtUserInput {
  userId: string;
  username: string;
  jti: string;
  iat: number;
  exp: number;
  version: string;
  roles: UserRoles[];
  guildIds: string[];
  applicationId?: string;
  cacheMultiplier?: number;

  static isAdmin(user: JwtUser) {
    return user.roles.includes(UserRoles.ADMIN);
  }
}

export const fallbackUser: JwtUser = {
  userId: '526971716711350273',
  username: 'clashperk',
  roles: [UserRoles.ADMIN],
  jti: randomUUID(),
  guildIds: [],
  version: '1',
  exp: 0,
  iat: 0,
};

export const swaggerUser: JwtUser = {
  userId: '000000000000000000',
  username: 'swagger_user',
  roles: [UserRoles.VIEWER],
  jti: randomUUID(),
  guildIds: [],
  version: '1',
  exp: 0,
  iat: 0,
};
