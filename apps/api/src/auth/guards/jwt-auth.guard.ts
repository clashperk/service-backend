import { SNOWFLAKE_REGEX } from '@app/constants';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthGuardStrategies } from '../app.constants';
import { PUBLIC_METADATA } from '../decorators';
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
    return context.switchToHttp().getRequest<Request>();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return this.useMasterKey(context);
  }

  public useMasterKey(context: ExecutionContext) {
    const req = this.getRequest(context);

    const key = req.headers?.['x-api-key'] || req.query['apiKey'] || req.cookies?.['x-api-key'];
    const userId = req.headers?.['x-user-id'] || req.query['userId'] || req.cookies?.['x-user-id'];

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
