import { ArgumentsHost, UnauthorizedException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { HttpExceptionsFilter } from './http-exceptions-filter';
import { HttpLoggingMiddleware } from './http-logging.middleware';

jest.mock('@sentry/nestjs', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
  SentryExceptionCaptured: () => () => undefined,
}));

const PASSKEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
const TOKEN = 'Bearer eyJhbGciOiJIUzI1NiJ9.secret';

const loginRequest = () =>
  ({
    method: 'POST',
    url: '/v1/auth/login',
    originalUrl: '/v1/auth/login',
    ip: '127.0.0.1',
    body: { passKey: PASSKEY },
    headers: { 'authorization': TOKEN, 'x-access-token': TOKEN, 'user-agent': 'jest' },
  }) as unknown as Request;

const sentToSentry = (mock: jest.Mock) => JSON.stringify(mock.mock.calls);

describe('Sentry request logs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('leave out the passkey of a successful login', () => {
    const res = Object.assign(new EventEmitter(), { statusCode: 200, getHeader: () => undefined });
    new HttpLoggingMiddleware().use(loginRequest(), res as unknown as Response, () => undefined);
    res.emit('finish');

    expect(Sentry.logger.info).toHaveBeenCalled();
    expect(sentToSentry(Sentry.logger.info as jest.Mock)).not.toContain(PASSKEY);
  });

  it('leave out the passkey and auth headers of a failed request', () => {
    const res = { status: () => res, json: () => res };
    const host = {
      switchToHttp: () => ({ getRequest: () => loginRequest(), getResponse: () => res }),
    } as unknown as ArgumentsHost;
    new HttpExceptionsFilter().catch(new UnauthorizedException(), host);

    const sent = sentToSentry(Sentry.logger.error as jest.Mock);
    expect(Sentry.logger.error).toHaveBeenCalled();
    expect(sent).not.toContain(PASSKEY);
    expect(sent).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });
});
