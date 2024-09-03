import { ApiKeyGuard } from '@app/auth/guards/api-key-guard';
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';

@UseGuards(ApiKeyGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get('/legend-trophy-threshold')
  async getLegendThresholds() {
    return this.tasksService.getTrophyThresholds();
  }

  @Post('/backfill-legend-trophy-threshold')
  async backfillLegendThresholds() {
    return this.tasksService.backfillLegendTrophyThreshold();
  }
}
