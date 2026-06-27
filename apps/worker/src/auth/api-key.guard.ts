import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow('API_KEY');
  }

  public canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers?.['x-api-key'] || req.query['apiKey'];

    if (!key || key !== this.apiKey) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
