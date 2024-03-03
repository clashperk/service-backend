import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger(AppModule.name);

  const config = new DocumentBuilder()
    .setTitle('Service Backend API')
    .setDescription('Public and Private Routes for the Service Backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('AUTH')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/', app, document);

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = process.env.PORT || 8081;
  await app.listen(port);

  logger.log(`Service-Auth: http://localhost:${port}`);
}
bootstrap();
