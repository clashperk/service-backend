import { randomUUID } from 'node:crypto';
import { UserRoles } from './user-roles.dto';

export class JwtUserInput {
  jti: string;
  userId: string;
  username?: string;
  version: string;
  roles: UserRoles[];
  guildIds: string[];
}

export class JwtUser implements JwtUserInput {
  userId: string;
  username?: string;
  jti: string;
  iat: number;
  exp: number;
  version: string;
  roles: UserRoles[];
  guildIds: string[];

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
