import { applyDecorators } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

export function ApiKeyAuth(): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiSecurity('apiKey'));
}
