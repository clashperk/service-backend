import { ConsoleLogger, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import moment from 'moment';

export class CustomLogger extends ConsoleLogger {
  getTimestamp(): string {
    return moment().utcOffset('+05:30').format('DD-MM-YYYY kk:mm:ss');
  }
}

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger();

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    res.on('finish', () => {
      if (req.originalUrl === '/graphql') {
        this.logGraphQLRequest(req, res, startTime);
      } else {
        this.logRequest(req, res, startTime);
      }
    });

    next();
  }

  private logRequest(req: Request, res: Response, startTime: number) {
    const { method, originalUrl } = req;
    const { statusCode } = res;
    const responseTime = Date.now() - startTime;
    const remoteAddr = this.formatIp(this.getClientIp(req));
    const userId = `@${req.user?.username || req.user?.userId || 'unauthenticated'}`;

    const logMessage = [
      `${statusCode} ${originalUrl}`,
      `${responseTime}ms - ${remoteAddr}`,
      `${userId}`,
    ].join(' ');

    const logType = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'debug';
    this.logger[logType](logMessage, method);
  }

  private logGraphQLRequest(req: Request, res: Response, startTime: number) {
    const { statusCode } = res;
    const responseTime = Date.now() - startTime;
    const remoteAddr = this.formatIp(this.getClientIp(req));
    const userId = req.user?.userId ?? '0x0';

    const logMessage = [
      `${statusCode} ${req.body?.operationName || req.originalUrl}`,
      `${responseTime}ms - ${remoteAddr}`,
      `${userId}`,
    ].join(' ');

    const logType = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'debug';
    this.logger[logType](logMessage, 'GRAPHQL');
  }

  private formatIp(ip?: string): string {
    if (ip === '::1') return 'localhost';
    return ip || 'invalid-ip';
  }

  private getClientIp(req: Request): string {
    return (req.headers['cf-connecting-ip'] || req.ip) as string;
  }
}
