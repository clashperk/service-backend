import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServiceRankingModule } from './service-ranking.module';

async function bootstrap() {
  const app = await NestFactory.create(ServiceRankingModule);
  const logger = new Logger('NestApplication');

  const port = process.env.PORT || 8085;
  await app.listen(port);

  logger.log(`Service-Clans: http://localhost:${port}`);
}
bootstrap();
