import { Config } from '@app/constants';
import { generateHash } from '@app/helpers';
import { CACHE_TTL_METADATA, CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Injectable, RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

export const CACHE_UNORDERED_BODY = 'cache:unordered-body';

function sortArrays(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortArrays).sort();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => [key, sortArrays(val)]),
    );
  }
  return value;
}

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext) {
    const ttl = this.reflector.getAllAndOverride(CACHE_TTL_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!ttl) return;

    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();

    const unordered = this.reflector.get<boolean>(CACHE_UNORDERED_BODY, context.getHandler());

    return this.createCacheKey(req, unordered);
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const res = context.switchToHttp().getResponse<Response>();
    const cacheKey = this.trackBy(context);

    if (cacheKey && !Config.IS_PROD) {
      res.setHeader('x-cache-key', cacheKey);
    }

    return super.intercept(context, next);
  }

  private createCacheKey(req: RawBodyRequest<Request>, unordered: boolean): string {
    if (req.method === 'GET') {
      return `cache:${req.originalUrl}`;
    }

    const params = req.path !== req.originalUrl ? req.originalUrl : ``;
    const raw =
      unordered && req.body && typeof req.body === 'object'
        ? JSON.stringify(sortArrays(req.body))
        : (req.rawBody?.toString('utf-8') ?? ``);
    const body = raw.concat(params);
    const hash = body.length ? `?${generateHash(body)}` : ``;

    return `cache:${req.path}${hash}`;
  }
}
