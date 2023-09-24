import { Controller, Get } from '@nestjs/common';
import { ClansService } from './service-clans.service';

@Controller()
export class ServiceClansController {
  constructor(private readonly serviceClansService: ClansService) {}

  @Get()
  getHello(): string {
    return this.serviceClansService.getHello();
  }
}
