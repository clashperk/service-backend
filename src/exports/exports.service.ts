import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { QueueTypes } from '../utils/constants';
import { ExportSheetInputDto } from './dto';

@Injectable()
export class ExportsService {
  constructor(@InjectQueue(QueueTypes.EXPORT) private queue: Queue<ExportSheetInputDto>) {}

  async exportData() {
    await this.queue.add({
      name: 'export job',
      data: { foo: 'bar' },
    });
  }
}
