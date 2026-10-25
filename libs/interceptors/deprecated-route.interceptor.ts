import { getClientIp } from '@app/helpers';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request } from 'express';
import { Observable } from 'rxjs';

/** Logs each call to a deprecated route, so its callers can be found before it is removed. */
@Injectable()
export class DeprecatedRouteInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    Sentry.logger.warn('Deprecated route called', {
      'method': req.method,
      'route': (req.route as { path?: string } | undefined)?.path,
      'user.userId': req.user?.userId,
      'ip': getClientIp(req),
      'user_agent': req.headers['user-agent'],
    });
    return next.handle();
  }
}
