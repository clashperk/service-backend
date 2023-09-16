import { NestFactory } from '@nestjs/core';
import { ServiceWarsModule } from './service-wars.module';

async function bootstrap() {
  const app = await NestFactory.create(ServiceWarsModule);
  await app.listen(3000);
}
bootstrap();
