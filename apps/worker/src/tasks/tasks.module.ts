import { Global, Module } from '@nestjs/common';
import { BulkWriterService } from './bulk-writer.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Global()
@Module({
  controllers: [TasksController],
  providers: [TasksService, BulkWriterService],
  exports: [BulkWriterService],
})
export class TasksModule {}
