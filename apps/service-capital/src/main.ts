import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServiceCapitalModule } from './service-capital.module';

async function bootstrap() {
  const app = await NestFactory.create(ServiceCapitalModule);
  const logger = new Logger('NestApplication');

  const port = process.env.PORT || 8080;
  await app.listen(port);

  logger.log(`Service-Capital: http://localhost:${port}`);
}
bootstrap();
