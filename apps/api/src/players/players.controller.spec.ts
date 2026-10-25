import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { RolesGuard, UserRoles } from '../auth';
import { PlayersController } from './players.controller';

// clash-client pulls in JSON the test setup can't load; the controller's services are never called.
vi.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

const contextFor = (handler: keyof PlayersController, roles: UserRoles[]) =>
  ({
    getHandler: () => PlayersController.prototype[handler],
    getClass: () => PlayersController,
    switchToHttp: () => ({
      getRequest: () => ({ params: {}, body: {}, query: {}, user: { roles, guildIds: [] } }),
    }),
  }) as unknown as ExecutionContext;

describe('PlayersController guards', () => {
  const guard = new RolesGuard(new Reflector());

  it('runs RolesGuard on the controller', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PlayersController)).toContain(RolesGuard);
  });

  it('refuses a non-admin adding a player to legend tracking', () => {
    expect(() => guard.canActivate(contextFor('addPlayerAccount', [UserRoles.USER]))).toThrow(
      ForbiddenException,
    );
  });

  it('lets an admin add a player to legend tracking', () => {
    expect(guard.canActivate(contextFor('addPlayerAccount', [UserRoles.ADMIN]))).toBe(true);
  });

  it('leaves the read routes open to any user', () => {
    expect(guard.canActivate(contextFor('getBattleLog', [UserRoles.USER]))).toBe(true);
  });
});
