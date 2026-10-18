import { Module } from '@nestjs/common';
import { CwlArchiveService } from './cwl-archive.service';
import { WarsController } from './wars.controller';
import { WarsService } from './wars.service';

@Module({
  controllers: [WarsController],
  providers: [WarsService, CwlArchiveService],
})
export class WarsModule {}
