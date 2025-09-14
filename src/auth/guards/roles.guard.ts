import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { ROLES_METADATA } from '../decorators/roles.decorator';
import { UserRoles } from '../dto/user-roles.dto';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  getRequest(context: ExecutionContext): Request {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest<Request>();
    }

    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req as Request;
  }

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRoles[]>(ROLES_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const { user } = this.getRequest(context);

    if (!user?.roles || !Array.isArray(user.roles)) {
      throw new ForbiddenException('Insufficient access or malformed JWT');
    }

    if (user.roles.includes(UserRoles.ADMIN)) return true;

    const isOk = roles.some((role) => user.roles.includes(role));
    if (!isOk) throw new ForbiddenException();

    return isOk;
  }
}
