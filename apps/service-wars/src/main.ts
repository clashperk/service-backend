import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServiceWarsModule } from './service-wars.module';

async function bootstrap() {
  const app = await NestFactory.create(ServiceWarsModule);
  const logger = new Logger('NestApplication');

  const port = process.env.PORT || 8083;
  await app.listen(port);

  logger.log(`Service-Wars: http://localhost:${port}`);
}
bootstrap();
