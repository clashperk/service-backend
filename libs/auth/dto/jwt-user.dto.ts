import { ApiProperty } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { UserRoles } from '../../dto/user-roles.enum';

/** Who a token is for, signed as its `aud` claim. Every token the API signs is for the API. */
export enum TokenAudience {
  DASHBOARD = 'dashboard',
  API = 'api',
}

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
  /** Settled by `JwtStrategy` from the token's claim; unset for the API key. */
  aud?: TokenAudience;

  static isAdmin(user: JwtUser) {
    return user.roles.includes(UserRoles.ADMIN);
  }

  static isApiToken(user: JwtUser) {
    return user.aud === TokenAudience.API;
  }
}

export const fallbackUser: JwtUser = {
  userId: '526971716711350273',
  username: 'clashperk',
  roles: [UserRoles.ADMIN],
  jti: randomUUID(),
  guildIds: [],
  version: 'v2',
  exp: 0,
  iat: 0,
};

export const swaggerUser: JwtUser = {
  userId: '000000000000000000',
  username: 'swagger_user',
  roles: [UserRoles.VIEWER],
  jti: randomUUID(),
  guildIds: [],
  version: 'v2',
  exp: 0,
  iat: 0,
};
