import { KAFKA_CONSUMER } from '@app/kafka';
import { Inject, Injectable } from '@nestjs/common';
import { Consumer } from 'kafkajs';

enum LogType {
  CLAN_LEVEL_CHANGE = 'clan_level_change',
  CLAN_WAR_LEAGUE_CHANGE = 'clan_war_league_change',
  CAPITAL_LEAGUE_CHANGE = 'capital_league_change',
  CLAN_MEMBER_CHANGE = 'clan_member_change',
}

@Injectable()
export class ConsumerService {
  constructor(@Inject(KAFKA_CONSUMER) private consumer: Consumer) {}

  async onModuleInit() {
    this.consumer.subscribe({ topics: Object.values(LogType), fromBeginning: true });

    await this.consumer.run({
      eachMessage: async ({ message, topic }) => {
        console.log({
          topic,
          value: message.value?.toString(),
        });
      },
    });
  }
}
