import { TokenType } from '@app/constants';
import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Role } from './roles.decorator';

export interface JwtUser {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  version: string;
  type: TokenType;
  roles: Role[];
}

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<Request>();
  if (!req.user) throw new UnauthorizedException('MissingAuthGuard');
  return req.user.sub;
});

export const CurrentUserExpanded = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<Request>();
  if (!req.user) throw new UnauthorizedException('MissingAuthGuard');
  return req.user;
});

declare module 'express' {
  interface Request {
    user?: JwtUser;
  }
}
