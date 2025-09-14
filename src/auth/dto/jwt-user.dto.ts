import { randomUUID } from 'node:crypto';
import { UserRoles } from './user-roles.dto';

export interface JwtUserInput {
  jti: string;
  userId: string;
  version: string;
  roles: UserRoles[];
}

export interface JwtUser extends JwtUserInput {
  userId: string;
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  version: string;
  roles: UserRoles[];
}

export const apiKeyUser: JwtUser = {
  userId: '526971716711350273',
  sub: '526971716711350273',
  roles: [UserRoles.ADMIN],
  jti: randomUUID(),
  version: '1',
  exp: 0,
  iat: 0,
};
