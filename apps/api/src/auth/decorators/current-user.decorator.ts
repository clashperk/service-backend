import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { JwtUser } from '../dto';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<Request>();

  if (!req.user) {
    throw new Error('This route is missing auth guard.');
  }

  return req.user;
});

declare module 'express' {
  interface Request {
    user?: JwtUser;
  }
}
