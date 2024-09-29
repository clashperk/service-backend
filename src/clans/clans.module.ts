import { ClashClientModule } from '@app/clash-client';
import { Module } from '@nestjs/common';
import { ClansController } from './clans.controller';
import { ClansService } from './clans.service';

@Module({
  imports: [ClashClientModule],
  controllers: [ClansController],
  providers: [ClansService],
})
export class ClansModule {}
