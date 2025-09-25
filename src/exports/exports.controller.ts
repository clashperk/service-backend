import { Config } from '@app/constants';
import { Controller, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ExportsService } from './exports.service';

@Controller('/exports')
@ApiExcludeController(Config.IS_PROD)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('/members')
  exportClanMembers() {
    return this.exportsService.exportClanMembers();
  }
}
