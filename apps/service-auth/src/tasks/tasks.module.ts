import { ClashClientModule } from '@app/clash-client';
import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [ClashClientModule],
  providers: [TasksService],
  controllers: [TasksController],
})
export class TasksModule {}
