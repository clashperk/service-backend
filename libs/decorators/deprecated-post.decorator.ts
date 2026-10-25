import { DeprecatedRouteInterceptor } from '@app/interceptors/deprecated-route.interceptor';
import { applyDecorators, Header, UseInterceptors } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

const DEPRECATED_AT = new Date('2026-10-25T00:00:00Z');
const SUNSET_AT = new Date('2026-11-25T00:00:00Z');

/** A POST kept beside its QUERY replacement until the sunset date; it answers with RFC 9745/8594 headers. */
export function DeprecatedPost(summary?: string): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary,
      deprecated: true,
      description: `Deprecated: send the same request with the \`QUERY\` method. This POST is removed on ${SUNSET_AT.toISOString().slice(0, 10)}.`,
    }),
    Header('Deprecation', `@${DEPRECATED_AT.getTime() / 1000}`),
    Header('Sunset', SUNSET_AT.toUTCString()),
    UseInterceptors(DeprecatedRouteInterceptor),
  );
}
