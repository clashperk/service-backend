import { Module } from '@nestjs/common';
import { WarsController } from './wars.controller';

@Module({
  controllers: [WarsController],
})
export class WarsModule {}
