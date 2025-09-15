import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger();

  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = Date.now();

    response.on('finish', () => {
      if (request.originalUrl === '/graphql') {
        this.logGraphQLRequest(request, response, startTime);
      } else {
        this.logRequest(request, response, startTime);
      }
    });

    next();
  }

  private logRequest(request: Request, response: Response, startTime: number) {
    const { method, originalUrl } = request;
    const { statusCode } = response;
    const responseTime = Date.now() - startTime;
    const remoteAddr = this.formatIp(this.getClientIp(request));
    const userId = request.user?.userId ?? '0x0';

    const logMessage = [
      `${statusCode} ${originalUrl}`,
      `${responseTime}ms - ${remoteAddr}`,
      `${userId}`,
    ].join(' ');

    const logType = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'verbose';
    this.logger[logType](logMessage, method);
  }

  private logGraphQLRequest(request: Request, response: Response, startTime: number) {
    const { statusCode } = response;
    const responseTime = Date.now() - startTime;
    const remoteAddr = this.formatIp(this.getClientIp(request));
    const userId = request.user?.userId ?? '0x0';

    const logMessage = [
      `${statusCode} ${request.body?.operationName || request.originalUrl}`,
      `${responseTime}ms - ${remoteAddr}`,
      `${userId}`,
    ].join(' ');

    const logType = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'verbose';
    this.logger[logType](logMessage, 'GRAPHQL');
  }

  private formatIp(ip?: string): string {
    if (ip === '::1') return 'localhost';
    return ip || 'invalid-ip';
  }

  private getClientIp(request: Request): string {
    return (request.headers['cf-connecting-ip'] || request.ip) as string;
  }
}
