import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import KeyvRedis from '@keyv/redis';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';

import { ClashClientModule } from '@app/clash-client';
import { DiscordOauthModule } from '@app/discord-oauth';
import { HttpCacheInterceptor, HttpLoggingMiddleware } from '@app/interceptors';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClansModule } from './clans/clans.module';
import { ClickhouseModule } from './db';
import { MongoDbModule } from './db/mongodb.module';
import { RedisClientModule } from './db/redis.module';
import { ExportsModule } from './exports/exports.module';
import { GuildsModule } from './guilds/guilds.module';
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
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        url: configService.getOrThrow('REDIS_URL'),
      }),
      inject: [ConfigService],
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (configService: ConfigService) => ({
        ttl: 10 * 60 * 1000,
        stores: [new KeyvRedis(configService.getOrThrow('REDIS_URL'))],
      }),
      inject: [ConfigService],
    }),

    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      imports: [],
      driver: ApolloDriver,
      useFactory: () => ({
        autoSchemaFile: true,
        sortSchema: true,
        persistedQueries: false,
        plugins: [ApolloServerPluginLandingPageLocalDefault()],
        playground: false,
        introspection: true,
      }),
      inject: [ConfigService],
    }),

    RedisClientModule,
    MongoDbModule,
    ClickhouseModule,

    AuthModule,
    ClansModule,
    ExportsModule,
    GuildsModule,
    LinksModule,
    MetricsModule,
    PlayersModule,
    RostersModule,
    TasksModule,
    UsersModule,
    WarsModule,
    WebhookModule,

    ClashClientModule,
    DiscordOauthModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggingMiddleware).forRoutes('*');
  }
}
