import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, CronService],
})
export class TasksModule {}
