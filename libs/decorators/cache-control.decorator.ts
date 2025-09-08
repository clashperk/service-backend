import { CacheTTL } from '@nestjs/cache-manager';
import { applyDecorators, Header } from '@nestjs/common';

export function Cache(seconds: number): MethodDecorator {
  if (process.env.NODE_ENV === 'production') {
    return applyDecorators(
      CacheTTL(seconds * 1000),
      Header('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds}`),
    );
  }
  return applyDecorators(CacheTTL(10 * 1000), Header('Cache-Control', 'no-store'));
}
