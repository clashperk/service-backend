import { Global, Module } from '@nestjs/common';
import { LegendsController } from './legends.controller';
import { LegendsService } from './legends.service';
import { LegendTasksService } from './services/legend-tasks.service';

@Global()
@Module({
  controllers: [LegendsController],
  providers: [LegendsService, LegendTasksService],
  exports: [LegendsService, LegendTasksService],
})
export class LegendsModule {}
