process.env.TZ = 'UTC';
import 'dotenv/config';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import * as Swagger from './swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  const logger = new Logger(AppModule.name);
  const config = app.get(ConfigService);

  app.enableCors();
  app.use(cookieParser());
  app.set('trust proxy', true);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  Swagger.build(app);
  app.enableVersioning({ defaultVersion: ['1', '2'], type: VersioningType.URI });

  const port = config.get<number>('PORT', 8080);
  await app.listen(port);

  logger.log(`GraphQL running on: http://localhost:${port}/graphql`);
  logger.log(`HTTP running on: http://localhost:${port}/docs`);
}
bootstrap(); // eslint-disable-line
