import { Module } from '@nestjs/common';
import { ServiceClansController } from './service-clans.controller';
import { ClansService } from './service-clans.service';

@Module({
  imports: [],
  controllers: [ServiceClansController],
  providers: [ClansService],
})
export class ServiceClansModule {}
