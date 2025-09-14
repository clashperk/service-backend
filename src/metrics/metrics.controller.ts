import { PRODUCTION_MODE } from '@app/constants';
import { Cache } from '@app/decorators';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeController, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, UseApiKey, UserRoles } from '../auth';
import { GetCommandsUsageLogsDto, GetCommandsUsageLogsInputDto } from './dto';
import { MetricsService } from './metrics.service';

@Controller('/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@UseApiKey()
@ApiSecurity('apiKey')
@Roles([UserRoles.ADMIN])
@ApiExcludeController(PRODUCTION_MODE)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('/commands-usage-logs')
  @Cache(60)
  getCommandsUsageLogs(
    @Query() input: GetCommandsUsageLogsInputDto,
  ): Promise<GetCommandsUsageLogsDto> {
    return this.metricsService.getCommandsUsageLogs(input);
  }
}
