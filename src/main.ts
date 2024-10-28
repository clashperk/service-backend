import { morganLogger } from '@app/helper';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
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
    .setTitle('Service Backend API')
    .setDescription('Public and Private Routes for the Service Backend API')
    .setVersion('v1')
    .addTag('AUTH')
    .addTag('DISCORD')
    .addTag('LINKS')
    .addTag('PLAYERS')
    .addTag('CLANS')
    .addTag('GUILDS')
    .build();
  const document = SwaggerModule.createDocument(app, builder);
  SwaggerModule.setup('/', app, document, {
    jsonDocumentUrl: 'swagger/json',
  });

  app.enableVersioning({ type: VersioningType.URI });

  const port = config.get('PORT', 8081);
  await app.listen(port);

  logger.log(`Service-Auth: http://localhost:${port}`);
}
bootstrap();
