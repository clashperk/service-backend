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

    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();

    return this.createCacheKey(request);
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const response = context.switchToHttp().getResponse<Response>();
    const cacheKey = this.trackBy(context);

    if (cacheKey && !Config.IS_PROD) {
      response.setHeader('x-cache-key', cacheKey);
    }

    if (cacheKey) {
      const timestamp = await this.cacheManager.ttl(cacheKey);
      if (typeof timestamp === 'number' && timestamp > Date.now()) {
        response.setHeader(
          'Cache-Control',
          `public, max-age=${Math.floor((timestamp - Date.now()) / 1000)}`,
        );
      }
    }

    return super.intercept(context, next);
  }

  private createCacheKey(request: RawBodyRequest<Request>): string {
    if (request.method === 'GET') {
      return `cache:${request.originalUrl}`;
    }

    const params = request.path !== request.originalUrl ? request.originalUrl : ``;
    const body = (request.rawBody?.toString('utf-8') ?? ``).concat(params);
    const hash = body.length ? `?${generateHash(body)}` : ``;

    return `cache:${request.path}${hash}`;
  }
}
