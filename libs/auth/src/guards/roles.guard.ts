import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest<Request>();
    if (!user?.roles) throw new ForbiddenException('Insufficient Access or Malformed JWT');

    if (user.roles.includes(Role.ADMIN)) return true;

    const isOk = requiredRoles.some((role) => user.roles.includes(role));
    if (!isOk) throw new ForbiddenException('Insufficient Access');

    return isOk;
  }
}
