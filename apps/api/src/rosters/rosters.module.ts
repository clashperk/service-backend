import { ClashClientModule } from '@app/clash-client';
import { Module } from '@nestjs/common';
import { RostersController } from './rosters.controller';
import { RostersService } from './rosters.service';

@Module({
  imports: [ClashClientModule],
  controllers: [RostersController],
  providers: [RostersService],
})
export class RostersModule {}
