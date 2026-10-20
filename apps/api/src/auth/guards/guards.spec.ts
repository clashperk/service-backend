import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fallbackUser, JwtUser, UserRoles } from '../dto';
import { JwtStrategy } from '../strategies';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

jest.mock('@app/discord-rest', () => ({ DiscordRestService: class {} }));

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
  const strategy = () => {
    const config = { getOrThrow: () => 'secret' };
    const auth = { revalidateJwtUser: (payload: JwtUser) => Promise.resolve(payload) };
    return new JwtStrategy(config as never, auth as never);
  };

  it("marks tokens the dashboard didn't sign as API tokens", async () => {
    await expect(strategy().validate(user({ version: '1' }))).resolves.toMatchObject({
      portal: false,
    });
    await expect(strategy().validate(user({ version: 'v2' }))).resolves.toMatchObject({
      portal: true,
    });
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
});
