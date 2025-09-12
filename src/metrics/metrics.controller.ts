import { Cache } from '@app/decorators';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth';
import { GetCommandsUsageLogsInputDto } from './dto';
import { MetricsService } from './metrics.service';

@Controller('/metrics')
@UseGuards(ApiKeyGuard)
@ApiSecurity('apiKey')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('/commands-usage-logs')
  @Cache(60)
  getCommandsUsageLogs(@Query() input: GetCommandsUsageLogsInputDto) {
    return this.metricsService.getCommandsUsageLogs(input);
  }
}
