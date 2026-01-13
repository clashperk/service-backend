import { QueueTypes } from '@app/constants';
import { GoogleSheetModule } from '@app/google-sheet';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ExportsMembersService } from './exports-members.service';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { ExportsConsumerService } from './services/exports-consumer.service';
import { ReusableSheetService } from './services/reusable-sheet.service';

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
    GoogleSheetModule,
  ],
  controllers: [ExportsController],
  providers: [ExportsService, ExportsMembersService, ReusableSheetService, ExportsConsumerService],
})
export class ExportsModule {}
