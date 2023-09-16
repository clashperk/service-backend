import { Controller, Get } from '@nestjs/common';
import { ServiceCapitalService } from './service-capital.service';

@Controller()
export class ServiceCapitalController {
  constructor(private readonly serviceCapitalService: ServiceCapitalService) {}

  @Get()
  getHello(): string {
    return this.serviceCapitalService.getHello();
  }
}
