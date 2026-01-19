import { ClashClientService } from '@app/clash-client';
import { JobTypes, QueueTypes } from '@app/constants';
import { CronTab } from '@app/decorators';
import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN, RedisService } from '../db';
import { ExportMembersInput } from './dto';
import { ExportsMembersService } from './exports-members.service';
import { ReusableSheetService, SheetType } from './services/reusable-sheet.service';

@Injectable()
export class ExportsService {
  constructor(
    @InjectQueue(QueueTypes.EXPORT) private queue: Queue<ExportMembersInput>,
    @Inject(MONGODB_TOKEN) private db: Db,
    private clashClientService: ClashClientService,
    private redisService: RedisService,
    private exportsMembersService: ExportsMembersService,
    private reusableSheetService: ReusableSheetService,
  ) {}

  @CronTab('55 4 * * 1', {
    monitor: 'auto-export-clan-members',
  })
  async autoExportClanMembers() {
    const schedules = await this.googleSheets.find({ scheduled: true }).toArray();
    for (const schedule of schedules) {
      await this.queue.add(JobTypes.EXPORT_MEMBERS, {
        clanTags: schedule.clanTags,
        scheduled: true,
        guildId: schedule.guildId,
      });
    }
  }

  async exportClanMembers(input: ExportMembersInput) {
    const scheduled = await this.reusableSheetService.getSheet({
      scheduled: true,
      clanTags: input.clanTags,
      guildId: input.guildId,
      sheetType: SheetType.CLAN_MEMBERS,
    });
    if (scheduled) return scheduled;

    return this.exportsMembersService.exportClanMembers(input);
  }

  private get links() {
    return this.db.collection(Collections.PLAYER_LINKS);
  }

  private get googleSheets() {
    return this.db.collection(Collections.GOOGLE_SHEETS);
  }
}
