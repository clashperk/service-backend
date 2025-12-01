import { applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export function ApiExcludeRoute(): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiExtension('x-internal', 1));
}

export function ApiExcludeTypings(): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiExtension('x-typings-ignored', 1));
}
