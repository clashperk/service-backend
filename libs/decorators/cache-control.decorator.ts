import { Config } from '@app/constants';
import {
  CACHE_UNORDERED_BODY,
  HttpCacheInterceptor,
} from '@app/interceptors/http-cache.interceptor';
import { CacheTTL } from '@nestjs/cache-manager';
import { applyDecorators, Header, SetMetadata, UseInterceptors } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import type { Request } from 'express';

export interface CacheOptions {
  /** Body arrays are sets: sort them before hashing so reordered inputs share a cache entry. */
  unorderedBody?: boolean;
}

export function Cache(seconds: number, options: CacheOptions = {}): MethodDecorator {
  if (Config.IS_PROD) {
    return applyDecorators(
      UseInterceptors(HttpCacheInterceptor),
      SetMetadata(CACHE_UNORDERED_BODY, options.unorderedBody ?? false),
      CacheTTL((ctx) => {
        const ttl = seconds * 1000;

        const req = ctx.switchToHttp().getRequest<Request>();

        if (req.user?.cacheMultiplier) {
          return ttl + req.user.cacheMultiplier * ttl;
        }

        return ttl;
      }),
      ApiExtension('x-max-age', seconds),
      Header('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=3600`),
    );
  }

  return applyDecorators(Header('Cache-Control', 'no-cache'), ApiExtension('x-max-age', seconds));
}
