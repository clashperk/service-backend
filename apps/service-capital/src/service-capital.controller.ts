import { Controller, Get } from '@nestjs/common';
import { CapitalService } from './service-capital.service';

@Controller()
export class ServiceCapitalController {
  constructor(private readonly serviceCapitalService: CapitalService) {}

  @Get()
  getHello(): string {
    return this.serviceCapitalService.getHello();
  }
}
