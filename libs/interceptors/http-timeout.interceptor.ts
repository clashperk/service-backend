import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Request } from 'express';
import { throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

const REQUEST_TIMEOUT_SECONDS = 30 * 1000;

@Injectable()
export class HttpTimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.url?.includes('/exports') || request.url?.includes('/tasks')) {
      return next.handle();
    }

    return next.handle().pipe(
      timeout(REQUEST_TIMEOUT_SECONDS),
      catchError((error: Error) => {
        if (error instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => error);
      }),
    );
  }
}
