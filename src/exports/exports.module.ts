import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QueueTypes } from '../app.constants';
import { ExportsConsumer } from './consumer.service';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueTypes.EXPORT,
      defaultJobOptions: {
        attempts: 3,
        backoff: 5000,
        timeout: 15000,
        removeOnComplete: true,
        removeOnFail: true,
        stackTraceLimit: 1,
      },
    }),
  ],
  controllers: [ExportsController],
  providers: [ExportsService, ExportsConsumer],
})
export class ExportsModule {}
