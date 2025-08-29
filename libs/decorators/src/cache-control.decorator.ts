import { applyDecorators, Header } from '@nestjs/common';

export function Cache(seconds: number): MethodDecorator {
  return applyDecorators(Header('Cache-Control', `max-age=${seconds}`));
}
