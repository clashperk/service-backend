import { Config } from '@app/constants';
import { ErrorResponseDto, UserRoles } from '@app/dto';
import { getTurnstileScript } from '@app/helpers/turnstile-script';
import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  OpenAPIObject,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { API_TAG_DESCRIPTIONS } from './api-tags';

const version = JSON.parse(readFileSync('./package.json', 'utf-8')).version;

type Operation = { 'tags'?: string[]; 'x-required-roles'?: UserRoles[] } & Record<string, unknown>;

/** API tokens can't call routes only dashboard sessions or admins may use, so those stay unpublished. */
const NOT_FOR_API_TOKENS = [UserRoles.USER, UserRoles.ADMIN];

const isPublished = (operation: Operation) => {
  const roles = operation['x-required-roles'] ?? [];
  return (
    !operation['x-internal'] &&
    !(roles.length && roles.every((role) => NOT_FOR_API_TOKENS.includes(role)))
  );
};

function filterOperations(
  document: OpenAPIObject,
  keep: (operation: Operation) => boolean,
): OpenAPIObject {
  const paths: OpenAPIObject['paths'] = {};
  for (const [path, pathItem] of Object.entries(document.paths)) {
    const operations = Object.entries(pathItem).filter(([, operation]) =>
      keep(operation as Operation),
    );
    if (operations.length) paths[path] = Object.fromEntries(operations);
  }

  const used = new Set(
    Object.values(paths).flatMap((pathItem) =>
      Object.values(pathItem).flatMap((operation) => (operation as Operation).tags ?? []),
    ),
  );
  return { ...document, paths, tags: document.tags?.filter((tag) => used.has(tag.name)) };
}

/** The full document, and the published one: no internal routes, none API tokens can't call. */
export function createDocuments(app: INestApplication) {
  const builder = new DocumentBuilder()
    .setTitle('ClashPerk Discord Bot API')
    .setDescription(
      [
        `### API Routes for ClashPerk Discord Bot and Services`,

        '[Terms of Service](https://clashperk.com/terms) | [Privacy Policy](https://clashperk.com/privacy)',
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
      description: 'in header (x-api-key: [key])',
    })
    .addGlobalResponse({ type: ErrorResponseDto, status: 500 });
  for (const [name, description] of Object.entries(API_TAG_DESCRIPTIONS)) {
    builder.addTag(name, description);
  }
  const config = builder.build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_, methodKey) => methodKey,
  });
  return { document, published: filterOperations(document, isPublished) };
}

export function build(app: NestExpressApplication) {
  const { document, published } = createDocuments(app);

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
    patchDocumentOnRequest: (req) => {
      if (req['query']?.['x-typings-ignored']) {
        return filterOperations(document, (operation) => !operation['x-typings-ignored']);
      }

      if (!Config.IS_PROD || req['cookies']?.['x-api-key'] === configService.get('API_KEY')) {
        return document;
      }

      return published;
    },
  };

  SwaggerModule.setup('/docs', app, document, customOptions);
}
