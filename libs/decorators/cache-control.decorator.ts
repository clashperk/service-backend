import { Config } from '@app/constants';
import { HttpCacheInterceptor } from '@app/interceptors';
import { CacheTTL } from '@nestjs/cache-manager';
import { applyDecorators, Header, UseInterceptors } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { Request } from 'express';

export function Cache(seconds: number): MethodDecorator {
  if (Config.IS_PROD) {
    return applyDecorators(
      UseInterceptors(HttpCacheInterceptor),
      CacheTTL((ctx) => {
        const ttl = seconds * 1000;

        const req = ctx.switchToHttp().getRequest<Request>();

        if (req.user?.cacheMultiplier) {
          return ttl + req.user.cacheMultiplier * ttl;
        }

        return ttl;
      }),
      ApiExtension('x-max-age', seconds),
      Header('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds}`),
    );
  }

  return applyDecorators(Header('Cache-Control', 'no-cache'), ApiExtension('x-max-age', seconds));
}
