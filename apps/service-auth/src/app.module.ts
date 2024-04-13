import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClansModule } from './clans/clans.module';
import { GuildsModule } from './guilds/guilds.module';
import { LinksModule } from './links/links.module';
import { PlayersModule } from './players/players.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongoDbModule,
    RedisModule,
    AuthModule,
    ClansModule,
    GuildsModule,
    LinksModule,
    PlayersModule,
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
  controllers: [],
  providers: [],
})
export class AppModule {}
