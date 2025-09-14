import { randomUUID } from 'node:crypto';
import { UserRoles } from './user-roles.dto';

export class JwtUserInput {
  jti: string;
  userId: string;
  version: string;
  roles: UserRoles[];
}

export class JwtUser implements JwtUserInput {
  userId: string;
  jti: string;
  iat: number;
  exp: number;
  version: string;
  roles: UserRoles[];

  static isAdmin(user: JwtUser) {
    return user.roles.includes(UserRoles.ADMIN);
  }
}

export const fallbackUser: JwtUser = {
  userId: '526971716711350273',
  roles: [UserRoles.ADMIN],
  jti: randomUUID(),
  version: '1',
  exp: 0,
  iat: 0,
};
