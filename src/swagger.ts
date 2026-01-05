import { Config } from '@app/constants';
import { ErrorResponseDto } from '@app/dto';
import { paragraph } from '@app/helpers';
import { getTurnstileScript } from '@app/helpers/turnstile-script';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  OpenAPIObject,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync('./package.json', 'utf-8')).version;

function filterRoutes({
  document,
  extension,
}: {
  document: OpenAPIObject;
  extension: string;
}): OpenAPIObject {
  const mutated = { ...document, paths: {} };
  for (const path in document.paths) {
    const pathItem = document.paths[path];

    const options = Object.entries(pathItem).filter(([_, operation]) => {
      return !operation?.[extension];
    });

    if (options.length > 0) {
      mutated.paths[path] = Object.fromEntries(options);
    }
  }
  return mutated;
}

export function build(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('ClashPerk Discord Bot API')
    .setDescription(
      [
        `### API Routes for ClashPerk Discord Bot and Services`,

        paragraph(
          `API endpoints are protected by **Cloudflare** with a global rate limit of **300 requests per 10 seconds**.`,
          `Response **caching is enabled**, with duration varying across different endpoints for optimal performance.`,
          `API **access is limited** and reviewed individually. If you'd like to request access, reach out to us on Discord.`,
        ),

        'By using this API, you agree to fair usage. Access may be revoked for abuse, misuse, or security violations.',

        '[Join our Discord](https://discord.gg/ppuppun) | [Terms of Service](https://clashperk.com/terms) | [Privacy Policy](https://clashperk.com/privacy)',
      ].join('\n\n'),
    )
    .setVersion(`v${version}`)
    .addServer('/v1', '[latest]')
    .addServer('/v2', '[unstable]')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description: 'in header (authorization: bearer [token])',
      },
      'bearer',
    )
    .addSecurity('apiKey', {
      type: 'apiKey',
      in: 'header',
      name: 'x-api-key',
      description: 'in header (x-api-key: [key]) or in query (?apiKey=[key])',
    })
    .addGlobalResponse({ type: ErrorResponseDto, status: 500 })
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_, methodKey) => methodKey,
  });
  const published = filterRoutes({ document, extension: 'x-internal' });

  const configService = app.get(ConfigService);
  const turnstileSiteKey = configService.getOrThrow('CLOUDFLARE_TURNSTILE_SITE_KEY');

  const customOptions: SwaggerCustomOptions = {
    jsonDocumentUrl: 'docs/json',
    yamlDocumentUrl: 'docs/yaml',
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: 0,
      tryItOutEnabled: true,
      displayRequestDuration: true,
      deepLinking: true,
      displayOperationId: !Config.IS_PROD,
      showExtensions: !Config.IS_PROD,
    },
    customJsStr: getTurnstileScript(turnstileSiteKey),
    patchDocumentOnRequest(req, res, document) {
      const config = app.get(ConfigService);

      if (req['query']?.['x-typings-ignored']) {
        return filterRoutes({ document, extension: 'x-typings-ignored' });
      }

      if (!Config.IS_PROD || req['cookies']?.['x-api-key'] === config.get('API_KEY')) {
        return document;
      }

      return published;
    },
  };

  SwaggerModule.setup('/docs', app, document, customOptions);
}
