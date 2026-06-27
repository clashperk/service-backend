import { ErrorCodes } from '@app/dto';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_METADATA } from '../decorators/roles.decorator';
import { UserRoles } from '../dto/user-roles.dto';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  getRequest(context: ExecutionContext): Request {
    return context.switchToHttp().getRequest<Request>();
  }

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRoles[]>(ROLES_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = this.getRequest(context);

    if (!this.checkGuildPermission(req)) {
      throw new ForbiddenException(ErrorCodes.GUILD_ACCESS_FORBIDDEN);
    }

    if (!roles?.length) return true;

    const { user } = req;

    if (!user?.roles || !Array.isArray(user.roles)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN, {
        description: 'Insufficient access or malformed JWT',
      });
    }

    if (user.roles.includes(UserRoles.ADMIN)) return true;

    const isOk = roles.some((role) => user.roles.includes(role));
    if (!isOk) throw new ForbiddenException();

    return isOk;
  }

  checkGuildPermission(req: Request): boolean {
    if (req.user?.roles.includes(UserRoles.ADMIN)) return true;

    const guildId = req.params?.guildId || req.body?.guildId || req.query?.guildId;
    if (guildId && !req.user?.guildIds?.includes(guildId)) return false;

    return true;
  }
}
