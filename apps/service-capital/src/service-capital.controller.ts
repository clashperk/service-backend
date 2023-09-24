import { Controller, Get } from '@nestjs/common';
import { CapitalService } from './service-capital.service';

@Controller()
export class ServiceCapitalController {
  constructor(private readonly capitalService: CapitalService) {}

  @Get()
  ping() {
    return this.capitalService.ping();
  }
}
