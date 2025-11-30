import { ApiExcludeRoute, ApiKeyAuth } from '@app/decorators';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards';
import { TasksService } from './tasks.service';

@Controller('/tasks')
@UseGuards(ApiKeyGuard)
@ApiKeyAuth()
@ApiExcludeRoute()
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post('/bulk-add-legend-players')
  bulkAddLegendPlayers() {
    return this.tasksService.bulkAddLegendPlayers();
  }

  @Post('/seed-legend-players')
  seedLegendPlayers() {
    return this.tasksService.seedLegendPlayers();
  }

  @Post('/migrate-legend-players')
  migrateLegendPlayers() {
    return this.tasksService.migrateLegendPlayers();
  }

  @Post('/update-legend-players')
  updateLegendPlayers() {
    return this.tasksService.updateLegendPlayers();
  }
}
