import { morganLogger } from '@app/helper';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const logger = new Logger(AppModule.name);

  const config = app.get(ConfigService);

  app.enableShutdownHooks();
  app.set('trust proxy', true);
  app.enableCors();
  app.use(morganLogger(logger));
  app.use(cookieParser(config.getOrThrow('COOKIE_SECRET')));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const builder = new DocumentBuilder()
    .setTitle('ClashPerk Discord Bot API')
    .setDescription(
      [
        '**Deprecating Soon!** Switch to the new API [https://api.clashperk.com/docs](https://api.clashperk.com/docs) by the end of 2025.',
        [
          `API endpoints are protected by **Cloudflare** with a global rate limit of **300 requests per 10 seconds**.`,
          `Response **caching is enabled**, with duration varying across different endpoints for optimal performance.`,
          `API **access is limited** and reviewed individually. If you'd like to request access, reach out to us on Discord.`,
        ].join('<br/>'),
        'By using this API, you agree to fair usage. Access may be revoked for abuse, misuse, or security violations.',
        '[Join our Discord](https://discord.gg/ppuppun) | [Terms of Service](https://clashperk.com/terms) | [Privacy Policy](https://clashperk.com/privacy)',
      ].join('\n\n'),
    )
    .setVersion('deprecating')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, builder);
  SwaggerModule.setup('/docs', app, document, {
    jsonDocumentUrl: 'swagger/json',
    yamlDocumentUrl: 'swagger/yaml',
  });

  const port = config.get('PORT', 8081);
  await app.listen(port);

  logger.log(`Service-Auth: http://localhost:${port}`);
}
bootstrap();
