import {
  DynamicModule,
  Global,
  Module,
  ModuleMetadata,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Consumer, ConsumerConfig, Kafka, KafkaConfig } from 'kafkajs';

const KAFKA_CONFIG = 'KAFKA_CONFIG';
export const KAFKA_CONSUMER = 'KAFKA_CONSUMER';

@Global()
@Module({})
export class KafkaConsumerModule implements OnModuleInit, OnApplicationShutdown {
  constructor(private moduleRef: ModuleRef) {}

  static forRootAsync(options: KafkaConsumerModuleOptions): DynamicModule {
    return {
      module: KafkaConsumerModule,
      providers: [
        {
          provide: KAFKA_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: KAFKA_CONSUMER,
          useFactory: async ({ kafkaConfig, consumerConfig }: KafkaConsumerConfig) => {
            const kafka = new Kafka(kafkaConfig);
            return kafka.consumer(consumerConfig);
          },
          inject: [KAFKA_CONFIG],
        },
      ],
      exports: [KAFKA_CONSUMER],
    };
  }

  onModuleInit() {
    const consumer = this.moduleRef.get<Consumer>(KAFKA_CONSUMER);
    return consumer.connect();
  }

  onApplicationShutdown() {
    const consumer = this.moduleRef.get<Consumer>(KAFKA_CONSUMER);
    return consumer.disconnect();
  }
}

type KafkaConsumerConfig = { kafkaConfig: KafkaConfig; consumerConfig: ConsumerConfig };

export interface KafkaConsumerModuleOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => KafkaConsumerConfig | Promise<KafkaConsumerConfig>;
  inject: any[];
}
