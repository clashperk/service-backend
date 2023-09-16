import { Module } from '@nestjs/common';
import { ServiceClansController } from './service-clans.controller';
import { ServiceClansService } from './service-clans.service';

@Module({
  imports: [],
  controllers: [ServiceClansController],
  providers: [ServiceClansService],
})
export class ServiceClansModule {}
