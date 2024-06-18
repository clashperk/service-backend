import { morganLogger } from '@app/helper';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const logger = new Logger(AppModule.name);

  app.enableShutdownHooks();
  app.set('trust proxy', true);
  app.enableCors();
  app.use(morganLogger(logger));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Service Backend API')
    .setDescription('Public and Private Routes for the Service Backend API')
    .setVersion('v1')
    .addTag('AUTH')
    .addTag('LINKS')
    .addTag('PLAYERS')
    .addTag('CLANS')
    .addTag('GUILDS')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/', app, document);

  app.enableVersioning({ type: VersioningType.URI });

  const port = process.env.PORT || 8081;
  await app.listen(port);

  logger.log(`Service-Auth: http://localhost:${port}`);
}
bootstrap();
