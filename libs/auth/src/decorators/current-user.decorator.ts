import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TokenType } from '@app/constants';

export interface JwtUser {
  sub: string;
  jti: string;
  type: TokenType;
  iat: number;
  exp: number;
}

export const CurrentUser = createParamDecorator((data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest().user.sub;
});

declare module 'express' {
  interface Request {
    user?: JwtUser;
  }
}
