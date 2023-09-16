import { Module } from '@nestjs/common';
import { ServiceCapitalController } from './service-capital.controller';
import { ServiceCapitalService } from './service-capital.service';

@Module({
  imports: [],
  controllers: [ServiceCapitalController],
  providers: [ServiceCapitalService],
})
export class ServiceCapitalModule {}
