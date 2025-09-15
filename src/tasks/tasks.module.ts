import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { LegendTasksService } from './legend-tasks.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, CronService, LegendTasksService],
})
export class TasksModule {}
