import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TasksService } from './tasks.service';

@Injectable()
export class CronService {
  constructor(private readonly tasksService: TasksService) {}

  @Cron('59 4 * * *', {
    timeZone: 'Etc/UTC',
  })
  runLegendTasks() {
    console.log('Running legend tasks...');
  }

  @Cron('0 5 22 * *', {
    timeZone: 'Etc/UTC',
  })
  runClanGamesTask() {
    console.log('Running clan games tasks...');
  }
}
