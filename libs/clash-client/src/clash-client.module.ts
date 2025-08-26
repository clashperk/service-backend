import { Module } from '@nestjs/common';
import { ClashClientService } from './clash-client.service';

@Module({
  providers: [ClashClientService],
  exports: [ClashClientService],
})
export class ClashClientModule {}
