import { Controller, Get } from '@nestjs/common';
import { WarsService } from './service-wars.service';

@Controller()
export class ServiceWarsController {
  constructor(private readonly serviceWarsService: WarsService) {}

  @Get()
  getHello(): string {
    return this.serviceWarsService.getHello();
  }
}
