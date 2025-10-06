import { Config } from '@app/constants';
import { HttpCacheInterceptor } from '@app/interceptors';
import { CacheTTL } from '@nestjs/cache-manager';
import { applyDecorators, Header, UseInterceptors } from '@nestjs/common';

export function Cache(seconds: number): MethodDecorator {
  if (Config.IS_PROD) {
    return applyDecorators(
      UseInterceptors(HttpCacheInterceptor),
      CacheTTL(seconds * 1000),
      Header('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds}`),
    );
  }

  return applyDecorators(
    UseInterceptors(HttpCacheInterceptor),
    CacheTTL(5 * 1000),
    Header('Cache-Control', 'no-store'),
  );
}
