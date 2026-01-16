import { CronTab } from '@app/decorators';
import { Injectable } from '@nestjs/common';
import { LegendTasksService } from '../../legends/services/legend-tasks.service';
import { ClanGamesTasksService } from './clan-games-tasks.service';

@Injectable()
export class AutoTasksService {
  constructor(
    private readonly legendTasksService: LegendTasksService,
    private clanGamesTasksService: ClanGamesTasksService,
  ) {}

  @CronTab('59 4 * * *', {
    monitor: 'legend-ranking-snapshot',
  })
  runLegendTasks() {
    return this.legendTasksService.takeSnapshot();
  }

  @CronTab('0 5 22 * *', {
    monitor: 'clan-games-log-cleanup',
  })
  runClanGamesTask() {
    return this.clanGamesTasksService.runClanGamesTask();
  }
}
