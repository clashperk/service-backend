import { ClashClientService } from '@app/clash-client';
import { QueueTypes } from '@app/constants';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { ExportSheetInputDto } from './dto';

@Injectable()
export class ExportsService {
  constructor(
    @InjectQueue(QueueTypes.EXPORT) private queue: Queue<ExportSheetInputDto>,
    private readonly clashClientService: ClashClientService,
  ) {}

  async exportClanMembers() {
    const clan = await this.clashClientService.getClan('#2L2YLJV2C');
    return clan?.memberList.map((mem) => ({
      name: mem.name,
      tag: mem.tag,
      trophies: mem.trophies,
      townHallLevel: mem.townHallLevel,
      expLevel: mem.expLevel,
    }));
  }
}
