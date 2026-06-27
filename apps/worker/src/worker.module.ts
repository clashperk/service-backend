import { BullModule } from '@nestjs/bull';
import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { ClashClientModule } from '@app/clash-client';
import * as Sentry from '@sentry/node';
import { ClickhouseModule, MongoDbModule, RedisClientModule } from './db';
import { HttpLoggingMiddleware } from './util/http-logging.middleware';
import { ElasticModule } from './db/elastic.module';
import { MongoService } from './db/mongodb.service';
import { RedisService } from './db/redis.service';
import { TasksModule } from './tasks/tasks.module';
import { TrackerModule } from './tracker/tracker.module';
import { AppController } from './worker.controller';
import { WorkerService } from './worker.service';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    serverName: 'clashperk_tracking_service',
    environment: process.env.NODE_ENV ?? 'development',
    integrations: [Sentry.httpIntegration({ breadcrumbs: false })],
  });
}

@Global()
@Module({
  providers: [WorkerService, RedisService, MongoService],
  exports: [WorkerService, RedisService, MongoService],
})
class WorkerModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        url: configService.getOrThrow('REDIS_URL'),
      }),
      inject: [ConfigService],
    }),

    RedisClientModule,
    MongoDbModule,
    ElasticModule,
    ClickhouseModule,

    WorkerModule,
    TrackerModule,
    TasksModule,

    ClashClientModule,
    TrackerModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggingMiddleware).forRoutes('*');
  }
}
