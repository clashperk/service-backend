import { SNOWFLAKE_REGEX } from '@app/constants';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthGuardStrategies } from '../app.constants';
import { PUBLIC_METADATA, USE_API_KEY_METADATA } from '../decorators';
import { fallbackUser } from '../dto';

@Injectable()
export class JwtAuthGuard extends AuthGuard(AuthGuardStrategies.JWT) {
  private apiKey: string;

  public constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    super();
    this.apiKey = this.configService.getOrThrow('API_KEY');
  }

  getRequest(context: ExecutionContext): Request {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest<Request>();
    }

    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req as Request;
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const useApiKey = this.reflector.getAllAndOverride<boolean>(USE_API_KEY_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (useApiKey) return this.canUseApiKey(context);

    return super.canActivate(context);
  }

  public canUseApiKey(context: ExecutionContext) {
    const req = this.getRequest(context);

    const key = (req.headers?.['x-api-key'] || req.query['apiKey']) as string;
    const userId = (req.headers?.['x-user-id'] || req.query['userId']) as string;

    if (!key || key !== this.apiKey) {
      return super.canActivate(context);
    }

    if (userId && SNOWFLAKE_REGEX.test(userId)) {
      req.user = Object.assign(fallbackUser, { userId });
    } else {
      req.user = fallbackUser;
    }

    return true;
  }
}
