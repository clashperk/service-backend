import { ApiExcludeRoute } from '@app/decorators';
import { Controller, Post } from '@nestjs/common';
import { ExportsService } from './exports.service';

@Controller('/exports')
@ApiExcludeRoute()
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('/members')
  exportClanMembers() {
    return this.exportsService.exportClanMembers();
  }
}
