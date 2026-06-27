process.env.TZ = 'UTC';
import 'dotenv/config';
import 'moment-duration-format';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { numCPUs } from '@app/helpers';
import cluster from 'cluster';
import * as Swagger from './util/swagger';
import { AppModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  const logger = new Logger(AppModule.name);
  const config = app.get(ConfigService);

  app.enableShutdownHooks();
  app.enableCors();
  app.set('trust proxy', true);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  Swagger.build(app);

  const port = config.get<number>('PORT', 8090);
  await app.listen(port);

  logger.log(`Worker running on: http://localhost:${port}/docs`);
}

function clustering(callback: () => unknown) {
  const logger = new Logger('Cluster');
  if (cluster.isPrimary) {
    logger.debug(`Master server started on pid ${process.pid}`);
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(
        `Worker id ${worker.id}, pid ${worker.process.pid} died with code ${code} and signal ${signal}.`,
      );
      cluster.fork();
    });
  } else {
    callback();
    logger.debug(`Cluster server started on pid ${process.pid}`);
  }
}

clustering(bootstrap);
