import { NestFactory } from '@nestjs/core';
import { ServiceClansModule } from './service-clans.module';

async function bootstrap() {
  const app = await NestFactory.create(ServiceClansModule);
  await app.listen(3000);
}
bootstrap();
