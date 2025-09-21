import { Module } from '@nestjs/common';
import { AutoTasksService } from './services/auto-tasks.service';
import { LegendTasksService } from './services/legend-tasks.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, AutoTasksService, LegendTasksService],
})
export class TasksModule {}
