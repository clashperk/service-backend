import { ErrorCodes } from '@app/dto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { SentryExceptionCaptured } from '@sentry/nestjs';
import { Request, Response } from 'express';
import { pick } from 'lodash';
import mapKeys from 'lodash/mapKeys';

const ErrorCodesMap = Object.fromEntries(
  Object.entries(ErrorCodes).map(([key, value]) => [value, key]),
) as Record<string, keyof typeof ErrorCodes>;

@Catch()
export class HttpExceptionsFilter implements ExceptionFilter {
  private logger = new Logger('ExceptionsHandler');

  @SentryExceptionCaptured()
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (!(exception instanceof HttpException)) this.logger.error(exception);

    const status: HttpStatus = exception.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR;
    const error = exception.getResponse?.();

    if (error?.['message'] && ErrorCodesMap[error['message']]) {
      error['code'] = error['message'];
      if (error['error']) error['message'] = error['error'];
    }

    const message: string = Array.isArray(error?.['message'])
      ? error['message'].join(', ')
      : typeof error === 'string'
        ? error
        : (error?.['message'] ?? exception.message);
    const code = error?.['code'] || HttpStatus[status];

    Sentry.logger.error(`[${req.method}] ${status} ${req.url}`, {
      error: message,
      code,
      status,
      method: req.method,
      path: req.url,
      ip: req.ip,
      ...mapKeys(
        req.user || {
          body: pick(req.body || {}, ['passKey']),
          headers: pick(req.headers || {}, ['x-access-token', 'authorization']),
        },
        (_, key) => `user.${key}`,
      ),
      user_agent: req.headers['user-agent'],
      referrer: req.headers['referrer'],
    });

    return res.status(status).json({
      code,
      message,
      statusCode: status,
      method: req.method,
      path: req.url,
    });
  }

  getErrorCode(status: HttpStatus) {
    return HttpStatus[status];
  }
}
