import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';

import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClansModule } from './clans/clans.module';
import { MongoDbModule } from './db/mongodb.module';
import { RedisClientModule } from './db/redis.module';
import { GuildsModule } from './guilds/guilds.module';
import { LinksModule } from './links/links.module';
import { PlayersModule } from './players/players.module';
import { RostersModule } from './rosters/rosters.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { WarsModule } from './wars/wars.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

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

    AuthModule,
    GuildsModule,
    UsersModule,
    ClansModule,
    WarsModule,
    PlayersModule,
    RostersModule,
    TasksModule,
    LinksModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
