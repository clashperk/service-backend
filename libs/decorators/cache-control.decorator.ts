import { PRODUCTION_MODE } from '@app/constants';
import { CacheTTL } from '@nestjs/cache-manager';
import { applyDecorators, Header } from '@nestjs/common';

export function Cache(seconds: number): MethodDecorator {
  if (PRODUCTION_MODE) {
    return applyDecorators(
      CacheTTL(seconds * 1000),
      Header('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds}`),
    );
  }
  return applyDecorators(CacheTTL(10 * 1000), Header('Cache-Control', 'no-store'));
}
