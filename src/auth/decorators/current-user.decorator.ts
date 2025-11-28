import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { JwtUser } from '../dto';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const req =
    context.getType() === 'http'
      ? context.switchToHttp().getRequest<Request>()
      : (GqlExecutionContext.create(context).getContext().req as Request);

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
