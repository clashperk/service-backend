import { ClashClientService } from '@app/clash-client';
import { QueueTypes } from '@app/constants';
import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN, RedisService } from '../db';
import { ExportMembersInput, ExportSheetInputDto } from './dto';
import { ExportsMembersService } from './exports-members.service';

@Injectable()
export class ExportsService {
  constructor(
    @InjectQueue(QueueTypes.EXPORT) private queue: Queue<ExportSheetInputDto>,
    @Inject(MONGODB_TOKEN) private db: Db,
    private clashClientService: ClashClientService,
    private redisService: RedisService,
    private exportsMembersService: ExportsMembersService,
  ) {}

  async exportClanMembers(input: ExportMembersInput) {
    return this.exportsMembersService.exportClanMembers(input);
  }

  private get links() {
    return this.db.collection(Collections.PLAYER_LINKS);
  }
}
