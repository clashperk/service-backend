import { Module } from '@nestjs/common';
import { ServiceWarsController } from './service-wars.controller';
import { ServiceWarsService } from './service-wars.service';

@Module({
  imports: [],
  controllers: [ServiceWarsController],
  providers: [ServiceWarsService],
})
export class ServiceWarsModule {}
