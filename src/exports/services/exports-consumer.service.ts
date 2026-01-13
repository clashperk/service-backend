import { JobTypes, QueueTypes } from '@app/constants';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { ExportMembersInput } from '../dto';
import { ExportsMembersService } from '../exports-members.service';

@Processor(QueueTypes.EXPORT)
export class ExportsConsumerService {
  constructor(private exportsMembersService: ExportsMembersService) {}

  @Process({ name: JobTypes.EXPORT_MEMBERS, concurrency: 100 })
  async process(job: Job<ExportMembersInput>) {
    const result = await this.exportsMembersService.exportClanMembers(job.data);
    console.log(result);

    return job.progress(100);
  }
}
