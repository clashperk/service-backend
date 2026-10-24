import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { AuthGuard } from '@nestjs/passport';
import { AuthGuardStrategies, TokenAudience } from '../app.constants';
import { fallbackUser, JwtUser, UserRoles } from '../dto';
import { JwtStrategy } from '../strategies';
import { ApiKeyGuard } from './api-key.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

jest.mock('@app/discord-rest', () => ({ DiscordRestService: class {} }));
jest.mock('@sentry/nestjs', () => ({ logger: { warn: jest.fn(), info: jest.fn() } }));

const GUILD = '111111111111111111';

const context = (req: object) =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => null,
    getClass: () => null,
  }) as unknown as ExecutionContext;

const user = (overrides: Partial<JwtUser>): JwtUser => ({
  userId: '999999999999999999',
  username: 'pug',
  jti: 'jti',
  iat: 0,
  exp: 0,
  version: '1',
  roles: [UserRoles.USER],
  guildIds: [GUILD],
  ...overrides,
});

const rolesGuard = (roles: UserRoles[]) =>
  new RolesGuard({ getAllAndOverride: () => roles } as unknown as Reflector);

const check = (roles: UserRoles[], who: JwtUser) =>
  rolesGuard(roles).canActivate(context({ user: who, params: { guildId: GUILD } }));

describe('RolesGuard', () => {
  it('lets a dashboard user into their server', () => {
    expect(check([UserRoles.USER], user({}))).toBe(true);
  });

  it('refuses API tokens on dashboard-only routes, admins included', () => {
    expect(() => check([UserRoles.USER], user({ portal: true }))).toThrow(ForbiddenException);
    expect(() =>
      check([UserRoles.USER], user({ portal: true, roles: [UserRoles.ADMIN], guildIds: [] })),
    ).toThrow(ForbiddenException);
  });

  it('still lets API tokens use routes that name their role', () => {
    const portal = user({ portal: true, roles: [UserRoles.VIEWER, UserRoles.FETCH_ROSTERS] });
    expect(check([UserRoles.USER, UserRoles.FETCH_ROSTERS], portal)).toBe(true);
    expect(check([UserRoles.ADMIN], user({ portal: true, roles: [UserRoles.ADMIN] }))).toBe(true);
  });

  it("lets the bot's API key through as a service", () => {
    expect(check([UserRoles.USER], { ...fallbackUser })).toBe(true);
  });
});

describe('JwtStrategy', () => {
  const req = (userAgent?: string) =>
    ({
      headers: { 'user-agent': userAgent },
      ip: '127.0.0.1',
      method: 'GET',
      url: '/v1/x',
    }) as never;
  beforeEach(() => jest.clearAllMocks());
  const strategy = (requireAudience = false) => {
    const config = {
      getOrThrow: () => 'secret',
      get: () => (requireAudience ? '1' : undefined),
    };
    const auth = { revalidateJwtUser: (payload: JwtUser) => Promise.resolve(payload) };
    return new JwtStrategy(config as never, auth as never);
  };
  const dashboard = (overrides: Partial<JwtUser> = {}) =>
    user({ aud: TokenAudience.DASHBOARD, ...overrides });
  const api = (overrides: Partial<JwtUser> = {}) => user({ aud: TokenAudience.API, ...overrides });

  it('reads API tokens and dashboard sessions from the audience, not the version', async () => {
    await expect(strategy().validate(req(), dashboard({ version: 'v2' }))).resolves.toMatchObject({
      portal: false,
    });
    await expect(strategy().validate(req(), api({ version: '1' }))).resolves.toMatchObject({
      portal: true,
    });
  });

  it('refuses a token signed for another audience', async () => {
    await expect(strategy().validate(req(), user({ aud: 'billing' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('falls back to the version for tokens without an audience, and logs them', async () => {
    await expect(strategy().validate(req(), user({ version: '1' }))).resolves.toMatchObject({
      portal: false,
    });
    await expect(strategy().validate(req(), user({ version: 'v2' }))).resolves.toMatchObject({
      portal: true,
    });
    expect(Sentry.logger.info).toHaveBeenCalledTimes(2);
  });

  it('refuses tokens without an audience once audiences are required', async () => {
    await expect(strategy(true).validate(req(), user({ version: '1' }))).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(strategy(true).validate(req(), api())).resolves.toMatchObject({ portal: true });
  });

  it('reports a dashboard session sent by a script, with its jti', async () => {
    await strategy().validate(req('python-requests/2.32'), dashboard({ jti: 'jti-1' }));
    await strategy().validate(req(), dashboard({ jti: 'jti-2' }));

    expect(Sentry.logger.warn).toHaveBeenCalledTimes(2);
    expect(Sentry.logger.warn).toHaveBeenCalledWith(
      'Dashboard token sent by a script',
      expect.objectContaining({ 'token.jti': 'jti-1', 'user_agent': 'python-requests/2.32' }),
    );
  });

  it('stays quiet for browsers and API tokens', async () => {
    const chrome = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';
    await strategy().validate(req(chrome), dashboard());
    await strategy().validate(req('curl/8.7.1'), api({ version: '1' }));

    expect(Sentry.logger.warn).not.toHaveBeenCalled();
  });
});

describe('JwtAuthGuard', () => {
  it("gives each API-key request its own user, so one caller's ID doesn't leak", () => {
    const guard = new JwtAuthGuard(
      { getAllAndOverride: () => false } as unknown as Reflector,
      { getOrThrow: () => 'key' } as never,
    );
    const first = { headers: { 'x-api-key': 'key', 'x-user-id': '222222222222222222' }, query: {} };
    const second = { headers: { 'x-api-key': 'key' }, query: {} };
    void guard.canActivate(context(first));
    void guard.canActivate(context(second));
    expect((first as { user?: JwtUser }).user?.userId).toBe('222222222222222222');
    expect((second as { user?: JwtUser }).user?.userId).toBe(fallbackUser.userId);
    expect(fallbackUser.userId).toBe('526971716711350273');
  });

  it('ignores an API key in the query string, which ends up in logs', () => {
    const guard = new JwtAuthGuard(
      { getAllAndOverride: () => false } as unknown as Reflector,
      { getOrThrow: () => 'key' } as never,
    );
    const jwtCheck = jest.spyOn(AuthGuard(AuthGuardStrategies.JWT).prototype, 'canActivate');
    jwtCheck.mockReturnValue(false);
    const req = { headers: {}, query: { apiKey: 'key' } };

    expect(guard.canActivate(context(req))).toBe(false);
    expect((req as { user?: JwtUser }).user).toBeUndefined();
    jwtCheck.mockRestore();
  });
});

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard({ getOrThrow: () => 'key' } as never);

  it('accepts the key in the x-api-key header', () => {
    expect(guard.canActivate(context({ headers: { 'x-api-key': 'key' }, query: {} }))).toBe(true);
  });

  it('refuses the key in the query string', () => {
    expect(() => guard.canActivate(context({ headers: {}, query: { apiKey: 'key' } }))).toThrow(
      UnauthorizedException,
    );
  });
});
