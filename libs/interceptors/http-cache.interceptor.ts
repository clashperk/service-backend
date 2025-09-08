import { generateHash } from '@app/helpers';
import { CACHE_TTL_METADATA, CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Injectable, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();

    const ttl = this.reflector.getAllAndOverride(CACHE_TTL_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!ttl) return;

    const params = request.path !== request.originalUrl ? request.originalUrl : ``;
    const body = (
      request.method !== 'GET' ? (request.rawBody?.toString('utf-8') ?? ``) : ``
    ).concat(params);
    const hash = body.length ? `?${generateHash(body)}` : ``;

    return `cache:${request.path}${hash}`;
  }

  intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const response = context.switchToHttp().getResponse<Response>();

    const cacheKey = this.trackBy(context);
    if (cacheKey && process.env.NODE_ENV !== 'production') {
      response.setHeader('X-Cache-Key', cacheKey);
    }

    return super.intercept(context, next);
  }
}
