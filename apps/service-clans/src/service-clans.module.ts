import { ClashClientModule } from '@app/clash-client';
import { KafkaProducerModule } from '@app/kafka';
import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServiceClansController } from './service-clans.controller';
import { ClansService } from './service-clans.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongoDbModule,
    RedisModule,
    ClashClientModule,
    KafkaProducerModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        return {
          kafkaConfig: {
            clientId: 'kafka-client-id',
            brokers: [configService.getOrThrow('KAFKA_BROKER')],
          },
          producerConfig: { allowAutoTopicCreation: true },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [ServiceClansController],
  providers: [ClansService],
})
export class ServiceClansModule {}
