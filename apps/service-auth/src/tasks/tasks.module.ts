import { ClashClientModule } from '@app/clash-client';
import { Module } from '@nestjs/common';
import { CleanupTasksService } from './cleanup.tasks.service';
import { LegendTasksService } from './legend.tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [ClashClientModule],
  providers: [LegendTasksService, CleanupTasksService],
  controllers: [TasksController],
})
export class TasksModule {}
