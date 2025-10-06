import { Config } from '@app/constants';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards';
import { TasksService } from './tasks.service';

@Controller('/tasks')
@UseGuards(ApiKeyGuard)
@ApiSecurity('apiKey')
@ApiExcludeController(Config.IS_PROD)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post('/bulk-add-legend-players')
  runTask() {
    return this.tasksService.bulkAddLegendPlayers();
  }
}
