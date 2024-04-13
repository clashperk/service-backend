import { NestFactory } from '@nestjs/core';
import { ServiceClansModule } from './service-clans.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(ServiceClansModule);
  const logger = new Logger('NestApplication');

  app.enableShutdownHooks();

  const port = process.env.PORT || 8082;
  await app.listen(port);

  logger.log(`Service-Clans: http://localhost:${port}`);
}
bootstrap();
