import { QueueTypes } from '@app/constants';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';

@Processor(QueueTypes.TASKS)
export class TasksConsumerService {
  constructor(@InjectQueue(QueueTypes.TASKS) private queue: Queue<any>) {}

  @Process()
  async process(job: Job<any>) {
    console.log(job.data);
    return job.progress(100);
  }
}
