import { applyDecorators, Header } from '@nestjs/common';

export function Cache(seconds: number): MethodDecorator {
  if (process.env.NODE_ENV === 'production') {
    return applyDecorators(
      Header('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds}`),
    );
  }
  return applyDecorators(Header('Cache-Control', 'no-store'));
}
