import { Config } from '@app/constants';
import { expandable, hyperlink, paragraph } from '@app/helpers';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerCustomOptions, SwaggerModule } from '@nestjs/swagger';

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

        expandable(
          'API Versioning',
          "You're viewing the upcoming API, which is currently under active development and may undergo changes before its stable release.",
          `The legacy API is unversioned and remains fully maintained at ${hyperlink('https://api-legacy.clashperk.com/docs')} until December 2025.`,
          'The upcoming API is formally versioned, starting with `/v1` (example request: GET `/v1/clans/{clanTag}`). Please ensure you migrate to this API before that date to avoid disruption.',
        ),

        '[Join our Discord](https://discord.gg/ppuppun) | [Terms of Service](https://clashperk.com/terms) | [Privacy Policy](https://clashperk.com/privacy)',
      ].join('\n\n'),
    )

    .setVersion('v1')
    .addServer(Config.IS_PROD ? 'https://api.clashperk.com/v1' : '/v1', '[latest]')
    .addServer(Config.IS_PROD ? 'https://api.clashperk.com/v2' : '/v2', '[unstable]')
    .addBearerAuth({
      type: 'http',
      description: 'in header (authorization: bearer [token])',
    })
    .addSecurity('apiKey', {
      type: 'apiKey',
      in: 'header',
      name: 'x-api-key',
      description: 'in header (x-api-key: [key]) or query param (?apiKey=[key])',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_, methodKey) => methodKey,
  });

  const customOptions: SwaggerCustomOptions = {
    jsonDocumentUrl: 'docs/json',
    yamlDocumentUrl: 'docs/yaml',
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: -1,
      tryItOutEnabled: true,
    },
  };

  SwaggerModule.setup('/docs', app, document, customOptions);
}
