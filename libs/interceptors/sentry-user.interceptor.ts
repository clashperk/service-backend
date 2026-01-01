import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import * as Sentry from '@sentry/nestjs';
import { Request } from 'express';

@Injectable()
export class SentryUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = this.getRequest(context);

    if (request?.user) {
      Sentry.setUser({
        id: request.user.userId,
        username: request.user.username,
        ip_address: request.ip,
      });
    }

    return next.handle();
  }

  private getRequest(context: ExecutionContext): Request {
    if (context.getType<GqlContextType>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext().req as Request;
    }
    return context.switchToHttp().getRequest();
  }
}
