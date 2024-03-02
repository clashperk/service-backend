import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger(AppModule.name);

  const config = new DocumentBuilder()
    .setTitle('Service Auth API')
    .setDescription('Public and private routes for the Service Auth')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('AUTH')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/', app, document);

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const port = process.env.PORT || 8081;
  await app.listen(port);

  logger.log(`Service-Auth: http://localhost:${port}`);
}
bootstrap();
