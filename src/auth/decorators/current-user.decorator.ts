import {
  ExecutionContext,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRoles } from '../dto/roles.dto';

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

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<Request>();
  if (!req.user) throw new InternalServerErrorException('MISSING_AUTH_GUARD');
  return req.user;
});

declare module 'express' {
  interface Request {
    user?: JwtUser;
  }
}
