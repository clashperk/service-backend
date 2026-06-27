import { Module } from '@nestjs/common';
import { AutoTasksService } from './services/auto-tasks.service';
import { ClanGamesTasksService } from './services/clan-games-tasks.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, AutoTasksService, ClanGamesTasksService],
})
export class TasksModule {}
