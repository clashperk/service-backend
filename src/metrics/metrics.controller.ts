import { PRODUCTION_MODE } from '@app/constants';
import { Cache } from '@app/decorators';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeController } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, UserRoles } from '../auth';
import { CommandsUsageLogItemsDto, GetCommandsUsageLogsInputDto } from './dto';
import { MetricsService } from './metrics.service';

@Controller('/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles([UserRoles.ADMIN])
@ApiExcludeController(PRODUCTION_MODE)
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
