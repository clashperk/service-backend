import { Controller, Get } from '@nestjs/common';
import { RankingService } from './service-ranking.service';

@Controller()
export class ServiceRankingController {
  constructor(private readonly serviceRankingService: RankingService) {}

  @Get()
  getHello(): string {
    return this.serviceRankingService.getHello();
  }
}
