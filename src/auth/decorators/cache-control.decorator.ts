import { applyDecorators, Header } from '@nestjs/common';

export function CacheControl(seconds: number): MethodDecorator {
  return applyDecorators(Header('Cache-Control', `max-age=${seconds}`));
}
