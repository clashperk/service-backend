import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
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
    return context.switchToHttp().getRequest();
  }
}
