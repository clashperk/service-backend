import { ApiExcludeRoute, Cache } from '@app/decorators';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth';
import { ExportMembersInput, ExportMembersOutputDto } from './dto';
import { ExportsService } from './exports.service';

@Controller('/exports')
@ApiExcludeRoute()
@UseGuards(ApiKeyGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Cache(10 * 60 * 1000)
  @Post('/members')
  exportClanMembers(@Body() body: ExportMembersInput): Promise<ExportMembersOutputDto> {
    return this.exportsService.exportClanMembers(body);
  }
}
