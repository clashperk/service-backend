import { Module } from '@nestjs/common';
import { RostersController } from './rosters.controller';

@Module({
  controllers: [RostersController],
})
export class RostersModule {}
