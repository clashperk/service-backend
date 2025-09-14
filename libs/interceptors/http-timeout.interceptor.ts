import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

const REQUEST_TIMEOUT_SECONDS = 30 * 1000;

@Injectable()
export class HttpTimeoutInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
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
