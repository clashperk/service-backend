import { ApiExcludeRoute, ApiExcludeTypings, ApiKeyAuth } from '@app/decorators';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards';
import { MessageOkDto } from '../links/dto';
import { TasksService } from './tasks.service';

@Controller('/tasks')
@UseGuards(ApiKeyGuard)
@ApiKeyAuth()
@ApiExcludeRoute()
@ApiExcludeTypings()
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post('/bulk-add-legend-players')
  bulkAddLegendPlayers(): Promise<MessageOkDto> {
    return this.tasksService.bulkAddLegendPlayers();
  }

  @Post('/seed-legend-players')
  seedLegendPlayers(): Promise<MessageOkDto> {
    return this.tasksService.seedLegendPlayers();
  }

  @Post('/migrate-legend-players')
  migrateLegendPlayers(): Promise<MessageOkDto> {
    return this.tasksService.migrateLegendPlayers();
  }

  @Post('/update-legend-players')
  updateLegendPlayers(): Promise<MessageOkDto> {
    return this.tasksService.updateLegendPlayers();
  }
}
