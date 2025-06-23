import { ClashClientModule } from '@app/clash-client';
import { Module } from '@nestjs/common';
import { ClansController } from './clans.controller';
import { ClansService } from './clans.service';
import { ClansResolver } from './clans.resolver';

@Module({
  imports: [ClashClientModule],
  controllers: [ClansController],
  providers: [ClansService, ClansResolver],
})
export class ClansModule {}
