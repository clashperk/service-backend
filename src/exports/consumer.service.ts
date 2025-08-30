import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { QueueTypes } from '../app.constants';
import { ExportSheetInputDto } from './dto';

@Processor(QueueTypes.EXPORT)
export class ExportsConsumer {
  constructor(@InjectQueue(QueueTypes.EXPORT) private queue: Queue<ExportSheetInputDto>) {}

  @Process()
  async process(job: Job<ExportSheetInputDto>) {
    console.log(job.data);
    return job.progress(100);
  }
}
