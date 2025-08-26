import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRoles } from '../dto/roles.dto';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRoles[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest<Request>();
    if (!user?.roles) throw new ForbiddenException('Insufficient access or malformed JWT');

    if (user.roles.includes(UserRoles.Admin)) return true;

    const isOk = requiredRoles.some((role) => user.roles.includes(role));
    if (!isOk) throw new ForbiddenException();

    return isOk;
  }
}
