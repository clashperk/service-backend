import { Config } from '@app/constants';
import { HttpCacheInterceptor } from '@app/interceptors';
import { CacheTTL } from '@nestjs/cache-manager';
import { applyDecorators, Header, UseInterceptors } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export function Cache(seconds: number): MethodDecorator {
  if (Config.IS_PROD) {
    return applyDecorators(
      UseInterceptors(HttpCacheInterceptor),
      CacheTTL(seconds * 1000),
      ApiExtension('x-max-age', seconds),
      Header('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds}`),
    );
  }

  return applyDecorators(Header('Cache-Control', 'no-cache'), ApiExtension('x-max-age', seconds));
}
