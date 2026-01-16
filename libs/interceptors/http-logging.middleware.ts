import { ConsoleLogger, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { NextFunction, Request, Response } from 'express';
import mapKeys from 'lodash/mapKeys';
import pick from 'lodash/pick';
import moment from 'moment';
import { fallbackUser } from '../../src/auth';

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
      this.logRequest(req, res, startTime);
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

    if (req.user?.userId !== fallbackUser.userId && statusCode < 400) {
      Sentry.logger.info(`[${req.method}] ${statusCode} ${req.url}`, {
        status: statusCode,
        method: req.method,
        path: req.url,
        ip: req.ip,
        ...mapKeys(
          req.user || {
            body: pick(req.body || {}, ['passKey']),
          },
          (_, key) => `user.${key}`,
        ),
        user_agent: req.headers['user-agent'],
      });
    }
  }

  private formatIp(ip?: string): string {
    if (ip === '::1') return 'localhost';
    return ip || 'invalid-ip';
  }

  private getClientIp(req: Request): string {
    return (req.headers['cf-connecting-ip'] || req.ip) as string;
  }
}
