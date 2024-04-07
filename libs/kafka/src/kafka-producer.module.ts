import {
  DynamicModule,
  Global,
  Module,
  ModuleMetadata,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Kafka, KafkaConfig, Partitioners, Producer, ProducerConfig } from 'kafkajs';

const KAFKA_CONFIG = 'KAFKA_CONFIG';
export const KAFKA_PRODUCER = 'KAFKA_PRODUCER';

@Global()
@Module({})
export class KafkaProducerModule implements OnModuleInit, OnApplicationShutdown {
  constructor(private moduleRef: ModuleRef) {}

  static forRootAsync(options: KafkaProducerModuleOptions): DynamicModule {
    return {
      module: KafkaProducerModule,
      providers: [
        {
          provide: KAFKA_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: KAFKA_PRODUCER,
          useFactory: async ({ kafkaConfig, producerConfig }: KafkaProducerConfig) => {
            const kafka = new Kafka(kafkaConfig);
            return kafka.producer({
              ...producerConfig,
              createPartitioner: Partitioners.DefaultPartitioner,
            });
          },
          inject: [KAFKA_CONFIG],
        },
      ],
      exports: [KAFKA_PRODUCER],
    };
  }

  onModuleInit() {
    const producer = this.moduleRef.get<Producer>(KAFKA_PRODUCER);
    return producer.connect();
  }

  onApplicationShutdown() {
    const producer = this.moduleRef.get<Producer>(KAFKA_PRODUCER);
    return producer.disconnect();
  }
}

type KafkaProducerConfig = { kafkaConfig: KafkaConfig; producerConfig: ProducerConfig };

export interface KafkaProducerModuleOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => KafkaProducerConfig | Promise<KafkaProducerConfig>;
  inject: any[];
}
