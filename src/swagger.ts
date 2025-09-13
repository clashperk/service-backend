import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerCustomOptions, SwaggerModule } from '@nestjs/swagger';

export function build(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('ClashPerk Discord Bot API')
    .setDescription(
      [
        `### API Routes for ClashPerk Discord Bot and Services`,
        [
          `API endpoints are protected by Cloudflare with a global rate limit of 300 requests per 10 seconds.`,
          `Response caching is enabled, with duration varying across different endpoints for optimal performance.`,
          `API access is limited and reviewed individually. If you'd like to request access, reach out to us on Discord.`,
        ].join('<br/>'),
      ].join('\n\n'),
    )
    .setVersion('v1')
    .addServer('/v1', '[latest]')
    .addServer('/v2', '[unstable]')
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
    .setExternalDoc('Join our Discord', 'https://discord.gg/ppuppun')
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
