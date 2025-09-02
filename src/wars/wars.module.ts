import { Module } from '@nestjs/common';
import { WarsController } from './wars.controller';
import { WarsService } from './wars.service';

@Module({
  controllers: [WarsController],
  providers: [WarsService],
})
export class WarsModule {}
