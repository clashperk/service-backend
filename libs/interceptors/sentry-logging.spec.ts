import type { Mock } from 'vitest';
import { ArgumentsHost, UnauthorizedException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { HttpExceptionsFilter } from './http-exceptions-filter';
import { HttpLoggingMiddleware } from './http-logging.middleware';

vi.mock('@sentry/nestjs', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
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
    headers: { 'authorization': TOKEN, 'x-access-token': TOKEN, 'user-agent': 'vitest' },
  }) as unknown as Request;

const sentToSentry = (mock: Mock) => JSON.stringify(mock.mock.calls);

describe('Sentry request logs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leave out the passkey of a successful login', () => {
    const res = Object.assign(new EventEmitter(), { statusCode: 200, getHeader: () => undefined });
    new HttpLoggingMiddleware().use(loginRequest(), res as unknown as Response, () => undefined);
    res.emit('finish');

    expect(Sentry.logger.info).toHaveBeenCalled();
    expect(sentToSentry(Sentry.logger.info as Mock)).not.toContain(PASSKEY);
  });

  it('leave out the passkey and auth headers of a failed request', () => {
    const res = { status: () => res, json: () => res };
    const host = {
      switchToHttp: () => ({ getRequest: () => loginRequest(), getResponse: () => res }),
    } as unknown as ArgumentsHost;
    new HttpExceptionsFilter().catch(new UnauthorizedException(), host);

    const sent = sentToSentry(Sentry.logger.error as Mock);
    expect(Sentry.logger.error).toHaveBeenCalled();
    expect(sent).not.toContain(PASSKEY);
    expect(sent).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('name a rejected token by fingerprint and claims, never the token itself', () => {
    const claims = { jti: 'jti-1', userId: '444444444444444444', version: '1', exp: 1 };
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const token = `eyJhbGciOiJIUzI1NiJ9.${body}.forged-signature`;
    const req = { ...loginRequest(), body: {}, headers: { authorization: `Bearer ${token}` } };
    const res = { status: () => res, json: () => res };
    const host = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ArgumentsHost;
    new HttpExceptionsFilter().catch(new UnauthorizedException(), host);

    const [[, fields]] = (Sentry.logger.error as Mock).mock.calls as [[string, object]];
    expect(fields).toMatchObject({
      'token.jti': 'jti-1',
      'token.user_id': '444444444444444444',
      'token.version': '1',
      'token.expired': true,
    });
    expect(fields['token.fingerprint']).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(fields)).not.toContain('forged-signature');
  });
});
