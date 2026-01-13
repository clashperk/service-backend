import { JobTypes, QueueTypes } from '@app/constants';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ExportMembersInput } from '../dto';
import { ExportsMembersService } from '../exports-members.service';

@Processor(QueueTypes.EXPORT)
export class ExportsConsumerService {
  private logger = new Logger(ExportsConsumerService.name);
  constructor(private exportsMembersService: ExportsMembersService) {}

  @Process({ name: JobTypes.EXPORT_MEMBERS, concurrency: 100 })
  async process(job: Job<ExportMembersInput>) {
    try {
      await this.exportsMembersService.exportClanMembers(job.data);
    } catch (error) {
      this.logger.error(error.message);
      await job.moveToFailed({ message: error.message });
    }
  }
}
