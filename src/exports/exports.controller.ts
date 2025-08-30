import { Controller, Post } from '@nestjs/common';
import { ExportsService } from './exports.service';

@Controller('/exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  exportData() {
    return this.exportsService.exportData();
  }
}
