import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthGuardStrategies } from '../app.constants';
import { PUBLIC_METADATA, USE_API_KEY_METADATA } from '../decorators';
import { apiKeyUser } from '../dto';

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
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers?.['x-api-key'] || req.query['apiKey'];

    if (!key || key !== this.apiKey) {
      return super.canActivate(context);
    }

    req.user = apiKeyUser;

    return true;
  }
}
