import { PRODUCTION_MODE } from '@app/constants';
import { Controller, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ExportsService } from './exports.service';

@Controller('/exports')
@ApiExcludeController(PRODUCTION_MODE)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('/members')
  exportClanMembers() {
    return this.exportsService.exportClanMembers();
  }
}
