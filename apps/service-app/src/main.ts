import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('NestApplication');

  const port = process.env.PORT || 8081;
  await app.listen(port);

  logger.log(`Service-App: http://localhost:${port}`);
}
bootstrap();
