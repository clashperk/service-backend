import { ClashClientModule } from '@app/clash-client';
import { ClickhouseModule } from '@app/clickhouse';
import { DiscordOAuthModule } from '@app/discord-oauth';
import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClansModule } from './clans/clans.module';
import { GuildsModule } from './guilds/guilds.module';
import { LinksModule } from './links/links.module';
import { PlayersModule } from './players/players.module';
import { RostersModule } from './rosters/rosters.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // RdbModule,

    // GraphQLModule.forRootAsync<ApolloDriverConfig>({
    //   imports: [],
    //   driver: ApolloDriver,
    //   useFactory: async () => ({
    //     autoSchemaFile: true,
    //     sortSchema: true,
    //     persistedQueries: false,
    //     plugins: [ApolloServerPluginLandingPageLocalDefault()],
    //     playground: false,
    //     introspection: true,
    //   }),
    //   inject: [ConfigService],
    // }),

    MongoDbModule,
    RedisModule,
    ClickhouseModule,
    AuthModule,
    ClansModule,
    GuildsModule,
    LinksModule,
    PlayersModule,
    RostersModule,
    ClashClientModule,
    DiscordOAuthModule,
    TasksModule,
    // ExportsModule,
    // KafkaProducerModule.forRootAsync({
    //   useFactory: (configService: ConfigService) => {
    //     return {
    //       kafkaConfig: {
    //         clientId: 'kafka-client-id',
    //         brokers: [configService.getOrThrow('KAFKA_BROKER')],
    //       },
    //       producerConfig: {},
    //     };
    //   },
    //   inject: [ConfigService],
    // }),
    // KafkaConsumerModule.forRootAsync({
    //   useFactory: (configService: ConfigService) => {
    //     return {
    //       kafkaConfig: {
    //         clientId: 'kafka-client-id',
    //         brokers: [configService.getOrThrow('KAFKA_BROKER')],
    //       },
    //       consumerConfig: { groupId: 'kafka-consumer-group' },
    //     };
    //   },
    //   inject: [ConfigService],
    // }),
    // ConsumerModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
