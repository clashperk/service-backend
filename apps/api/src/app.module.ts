import KeyvRedis from '@keyv/redis';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { ClashClientModule } from '@app/clash-client';
import { DiscordOauthModule } from '@app/discord-oauth';
import {
  HttpLoggingMiddleware,
  HttpTimeoutInterceptor,
  SentryUserInterceptor,
} from '@app/interceptors';
import { SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClansModule } from './clans/clans.module';
import { ClickhouseModule, MongoDbModule, RedisClientModule } from './db';
import { ExportsModule } from './exports/exports.module';
import { GuildsModule } from './guilds/guilds.module';
import { LegendsModule } from './legends/legends.module';
import { LinksModule } from './links/links.module';
import { MetricsModule } from './metrics/metrics.module';
import { PlayersModule } from './players/players.module';
import { RostersModule } from './rosters/rosters.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { WarsModule } from './wars/wars.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        url: `${configService.getOrThrow('REDIS_URL')}/1`,
      }),
      inject: [ConfigService],
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (configService: ConfigService) => ({
        ttl: 10 * 60 * 1000,
        stores: [new KeyvRedis(`${configService.getOrThrow('REDIS_URL')}/2`)],
      }),
      inject: [ConfigService],
    }),

    RedisClientModule,
    MongoDbModule,
    ClickhouseModule,

    AuthModule,
    LinksModule,
    ClansModule,
    PlayersModule,
    LegendsModule,
    WarsModule,
    RostersModule,
    UsersModule,
    GuildsModule,
    TasksModule,
    ExportsModule,
    MetricsModule,
    WebhookModule,
    ClashClientModule,
    DiscordOauthModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpTimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryUserInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggingMiddleware).forRoutes('*');
  }
}
