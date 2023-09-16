import { Controller, Get } from '@nestjs/common';
import { ServiceWarsService } from './service-wars.service';

@Controller()
export class ServiceWarsController {
  constructor(private readonly serviceWarsService: ServiceWarsService) {}

  @Get()
  getHello(): string {
    return this.serviceWarsService.getHello();
  }
}
