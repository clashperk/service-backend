import { ApiExcludeRoute, ApiExcludeTypings, Cache } from '@app/decorators';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, UserRoles } from '../auth';
import { CommandsUsageLogItemsDto, GetCommandsUsageLogsInputDto } from './dto';
import { MetricsService } from './metrics.service';

@Controller('/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([UserRoles.ADMIN])
@ApiBearerAuth()
@ApiExcludeRoute()
@ApiExcludeTypings()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('/commands-usage-logs')
  @Cache(60)
  getCommandsUsageLogs(
    @Query() input: GetCommandsUsageLogsInputDto,
  ): Promise<CommandsUsageLogItemsDto> {
    return this.metricsService.getCommandsUsageLogs(input);
  }
}
