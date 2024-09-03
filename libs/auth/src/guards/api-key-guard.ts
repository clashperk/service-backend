import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers?.['x-api-key'] || req.query['key'];
    if (!key) {
      throw new UnauthorizedException('x-api-key header is missing');
    }

    if (key !== this.configService.getOrThrow('API_KEY')) {
      throw new UnauthorizedException('Invalid x-api-key.');
    }

    return true;
  }
}
