import { ClashClientModule } from '@app/clash-client';
import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceClansController } from './service-clans.controller';
import { ClansService } from './service-clans.service';
import { KafkaProducerModule } from '@app/kafka';
import { logLevel } from 'kafkajs';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongoDbModule,
    RedisModule,
    ClashClientModule,
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
  ],
  controllers: [ServiceClansController],
  providers: [ClansService],
})
export class ServiceClansModule {}
