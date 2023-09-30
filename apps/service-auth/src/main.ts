import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  const logger = new Logger('NestApplication');

  const port = process.env.PORT || 8081;
  await app.listen(port);

  logger.log(`Service-Auth: http://localhost:${port}`);
}
bootstrap();
