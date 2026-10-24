import { JwtUser } from '@app/auth';
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
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import mapKeys from 'lodash/mapKeys';

const ErrorCodesMap = Object.fromEntries(
  Object.entries(ErrorCodes).map(([key, value]) => [value, key]),
) as Record<string, keyof typeof ErrorCodes>;

const readClaims = (token: string): Partial<JwtUser> | null => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as JwtUser;
  } catch {
    return null;
  }
};

/** Names a rejected token without logging it: a hash, and its claims, which nothing has verified. */
const describeToken = (req: Request) => {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-access-token'];
  if (typeof token !== 'string' || !token) return {};

  const claims = readClaims(token);
  return {
    'token.fingerprint': createHash('sha256').update(token).digest('hex').slice(0, 16),
    'token.jti': claims?.jti,
    'token.user_id': claims?.userId,
    'token.version': claims?.version,
    'token.expired': typeof claims?.exp === 'number' ? claims.exp * 1000 < Date.now() : undefined,
  };
};

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
      ...(req.user ? mapKeys(req.user, (_, key) => `user.${key}`) : describeToken(req)),
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
