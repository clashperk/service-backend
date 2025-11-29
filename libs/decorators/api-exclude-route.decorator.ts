import { applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export function ApiExcludeRoute(): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiExtension('x-protected', true));
}
