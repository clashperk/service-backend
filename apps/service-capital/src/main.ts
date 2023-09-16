import { NestFactory } from '@nestjs/core';
import { ServiceCapitalModule } from './service-capital.module';

async function bootstrap() {
  const app = await NestFactory.create(ServiceCapitalModule);
  await app.listen(3000);
}
bootstrap();
