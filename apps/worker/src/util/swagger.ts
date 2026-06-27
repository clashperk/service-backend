import { hyperlink } from '@app/helpers';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerCustomOptions, SwaggerModule } from '@nestjs/swagger';

export function build(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('ClashPerk Discord Bot Internal API')
    .setDescription(
      [
        'This is the internal API for the ClashPerk Discord Bot. It is used by the bot to interact with the tracking service.',
        `If you are looking for the public API, please visit ${hyperlink('https://api.clashperk.com/docs')}.`,
        '[Join our Discord](https://discord.gg/ppuppun) | [Terms of Service](https://clashperk.com/terms) | [Privacy Policy](https://clashperk.com/privacy)',
      ].join('\n\n'),
    )
    .setVersion('v1')
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
