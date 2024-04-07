import { KafkaConsumerModule, KafkaProducerModule } from '@app/kafka';
import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { logLevel } from 'kafkajs';
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
    KafkaProducerModule.forRootAsync({
      useFactory() {
        return {
          kafkaConfig: {
            clientId: 'kafka-client-id',
            brokers: ['localhost:9092'],
            logLevel: logLevel.NOTHING,
          },
          producerConfig: {},
        };
      },
      inject: [],
    }),
    KafkaConsumerModule.forRootAsync({
      useFactory() {
        return {
          kafkaConfig: {
            clientId: 'kafka-client-id',
            brokers: ['localhost:9092'],
            logLevel: logLevel.NOTHING,
          },
          consumerConfig: { groupId: 'kafka-consumer-group' },
        };
      },
      inject: [],
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
