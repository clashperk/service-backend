import { Controller, Get } from '@nestjs/common';
import { BackfillService } from './service-backfill.service';

@Controller()
export class ServiceBackfillController {
  constructor(private readonly serviceRankingService: BackfillService) {}

  @Get()
  getHello(): string {
    return this.serviceRankingService.getHello();
  }
}
