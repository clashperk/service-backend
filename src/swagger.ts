import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerCustomOptions, SwaggerModule } from '@nestjs/swagger';

export function build(app: NestExpressApplication) {
  const builder = new DocumentBuilder()
    .setTitle('ClashPerk Discord Bot API')
    .setDescription('API routes for ClashPerk Discord Bot and Services')
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
    .setExternalDoc('Join our Discord', 'https://discord.gg/ppuppun');

  builder
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management endpoints (requires access token)')
    .addTag('Guilds', 'Guild management endpoints (requires api key)')
    .addTag('Rosters', 'Roster management endpoints (requires access token)')
    .addTag('Tasks', 'Tasks management endpoints (requires api key)');

  const document = SwaggerModule.createDocument(app, builder.build(), {
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
