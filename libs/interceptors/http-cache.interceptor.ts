import { Config } from '@app/constants';
import { generateHash } from '@app/helpers';
import { CACHE_TTL_METADATA, CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Injectable, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext) {
    const ttl = this.reflector.getAllAndOverride(CACHE_TTL_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!ttl) return;

    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();

    return this.createCacheKey(req);
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const res = context.switchToHttp().getResponse<Response>();
    const cacheKey = this.trackBy(context);

    if (cacheKey && !Config.IS_PROD) {
      res.setHeader('x-cache-key', cacheKey);
    }

    if (cacheKey && !Config.IS_PROD) {
      const timestamp = await this.cacheManager.ttl(cacheKey);
      if (typeof timestamp === 'number' && timestamp > Date.now()) {
        res.setHeader(
          'Cache-Control',
          `public, max-age=${Math.floor((timestamp - Date.now()) / 1000)}`,
        );
      }
    }

    return super.intercept(context, next);
  }

  private createCacheKey(req: RawBodyRequest<Request>): string {
    if (req.method === 'GET') {
      return `cache:${req.originalUrl}`;
    }

    const params = req.path !== req.originalUrl ? req.originalUrl : ``;
    const body = (req.rawBody?.toString('utf-8') ?? ``).concat(params);
    const hash = body.length ? `?${generateHash(body)}` : ``;

    return `cache:${req.path}${hash}`;
  }
}
