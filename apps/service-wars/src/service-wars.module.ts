import { Module } from '@nestjs/common';
import { ServiceWarsController } from './service-wars.controller';
import { WarsService } from './service-wars.service';

@Module({
  imports: [],
  controllers: [ServiceWarsController],
  providers: [WarsService],
})
export class ServiceWarsModule {}
