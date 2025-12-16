import { Config } from '@app/constants';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LegendTasksService } from '../../legends/services/legend-tasks.service';
import { ClanGamesTasksService } from './clan-games-tasks.service';

@Injectable()
export class AutoTasksService {
  constructor(
    private readonly legendTasksService: LegendTasksService,
    private clanGamesTasksService: ClanGamesTasksService,
  ) {}

  @Cron('59 4 * * *', {
    timeZone: 'Etc/UTC',
    disabled: !Config.CRON_ENABLED,
  })
  runLegendTasks() {
    return this.legendTasksService.takeSnapshot();
  }

  @Cron('0 5 22 * *', {
    timeZone: 'Etc/UTC',
    disabled: !Config.CRON_ENABLED,
  })
  runClanGamesTask() {
    return this.clanGamesTasksService.runClanGamesTask();
  }
}
