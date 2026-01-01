import { ApiExcludeRoute } from '@app/decorators';
import { Body, Controller, Post } from '@nestjs/common';
import { ExportMembersInput } from './dto';
import { ExportsService } from './exports.service';

@Controller('/exports')
@ApiExcludeRoute()
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('/members')
  exportClanMembers(@Body() body: ExportMembersInput) {
    return this.exportsService.exportClanMembers(body);
  }
}
