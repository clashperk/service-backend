import { ApiKeyGuard } from '@app/auth/guards/api-key-guard';
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CleanupTasksService } from './cleanup.tasks.service';
import { LegendTasksService } from './legend.tasks.service';

@UseGuards(ApiKeyGuard)
@Controller('tasks')
export class TasksController {
  constructor(
    private legendTasksService: LegendTasksService,
    private cleanupTasksService: CleanupTasksService,
  ) {}

  @Get('/legend-trophy-threshold')
  async getLegendThresholds() {
    return this.legendTasksService.getTrophyThresholds();
  }

  @Post('/backfill-legend-trophy-threshold')
  async backfillLegendThresholds() {
    return this.legendTasksService.backfillLegendTrophyThreshold();
  }

  @Post('/cleanup-clans')
  async cleanupClans() {
    return this.cleanupTasksService.cleanupClans();
  }

  @Post('/cleanup-links')
  async cleanupLinks() {
    return this.cleanupTasksService.linksCleanup();
  }

  @Post('/clan-games-resync')
  async reSyncClanGamesPoints() {
    return this.cleanupTasksService.reSyncClanGamesPoints();
  }
}
