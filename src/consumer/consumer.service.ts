import { KAFKA_CONSUMER } from '@app/kafka';
import { Inject, Injectable } from '@nestjs/common';
import { Consumer } from 'kafkajs';

@Injectable()
export class ConsumerService {
  constructor(@Inject(KAFKA_CONSUMER) private consumer: Consumer) {}

  async onModuleInit() {
    // await this.consumer.subscribe({ topics: Object.values(LogType), fromBeginning: true });
    // await this.consumer.run({
    //   eachMessage: async ({ topic, message }) => {
    //     console.log({
    //       topic,
    //       value: message.value?.toString(),
    //     });
    //   },
    // });
  }
}
