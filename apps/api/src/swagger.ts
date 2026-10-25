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

/** Dashboard (`user`) routes are published for the dashboard and bot; admin-only ones aren't. */
const isPublished = (operation: Operation) => {
  const roles = operation['x-required-roles'] ?? [];
  return (
    !operation['x-internal'] && !(roles.length && roles.every((role) => role === UserRoles.ADMIN))
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

/** The full document, and the published one: no internal or admin-only routes. */
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

type Documents = ReturnType<typeof createDocuments>;

/** In production only the API key unlocks the full document; the typings view filters whichever applies. */
export function documentFor(
  { document, published }: Documents,
  req: { cookies?: Record<string, string>; query?: Record<string, unknown> },
  { apiKey, isProd }: { apiKey: string; isProd: boolean },
) {
  const visible = !isProd || req.cookies?.['x-api-key'] === apiKey ? document : published;
  if (!req.query?.['x-typings-ignored']) return visible;
  return filterOperations(visible, (operation) => !operation['x-typings-ignored']);
}

export function build(app: NestExpressApplication) {
  const documents = createDocuments(app);

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
    patchDocumentOnRequest: (req) =>
      documentFor(documents, req as Parameters<typeof documentFor>[1], {
        apiKey: configService.getOrThrow('API_KEY'),
        isProd: Config.IS_PROD,
      }),
  };

  SwaggerModule.setup('/docs', app, documents.document, customOptions);
}
