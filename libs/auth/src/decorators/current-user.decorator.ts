import { TokenType } from '@app/constants';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface JwtUser {
  sub: string;
  jti: string;
  type: TokenType;
  iat: number;
  exp: number;
}

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<Request>();
  return req.user;
});

declare module 'express' {
  interface Request {
    user?: JwtUser;
  }
}
