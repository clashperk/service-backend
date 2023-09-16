import { Controller, Get } from '@nestjs/common';
import { ServiceClansService } from './service-clans.service';

@Controller()
export class ServiceClansController {
  constructor(private readonly serviceClansService: ServiceClansService) {}

  @Get()
  getHello(): string {
    return this.serviceClansService.getHello();
  }
}
