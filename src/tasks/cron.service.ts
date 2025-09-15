import { CRONJOB_ENABLED } from '@app/constants';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LegendTasksService } from './legend-tasks.service';

@Injectable()
export class CronService {
  constructor(private readonly legendTasksService: LegendTasksService) {}

  @Cron('59 4 * * *', {
    timeZone: 'Etc/UTC',
    disabled: !CRONJOB_ENABLED,
  })
  runLegendTasks() {
    return this.legendTasksService.takeSnapshot();
  }

  @Cron('0 5 22 * *', {
    timeZone: 'Etc/UTC',
    disabled: !CRONJOB_ENABLED,
  })
  runClanGamesTask() {
    console.log('Running clan games tasks...');
  }
}
