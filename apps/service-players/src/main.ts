import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServicePlayersModule } from './service-players.module';

async function bootstrap() {
  const app = await NestFactory.create(ServicePlayersModule);
  const logger = new Logger('NestApplication');

  const port = process.env.PORT || 8084;
  await app.listen(port);

  logger.log(`Service-Players: http://localhost:${port}`);
}
bootstrap();
