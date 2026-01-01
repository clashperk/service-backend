import { ApiExcludeRoute } from '@app/decorators';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth';
import { ExportMembersInput, ExportMembersOutputDto } from './dto';
import { ExportsService } from './exports.service';

@Controller('/exports')
@ApiExcludeRoute()
@UseGuards(ApiKeyGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('/members')
  exportClanMembers(@Body() body: ExportMembersInput): Promise<ExportMembersOutputDto> {
    return this.exportsService.exportClanMembers(body);
  }
}
