import { ApiExcludeRoute, Cache } from '@app/decorators';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth';
import { ExportMembersInput, ExportMembersOutputDto } from './dto';
import { ExportsService } from './exports.service';
import { ApiTag } from '../api-tags';

@ApiTags(ApiTag.INTERNAL)
@Controller('/exports')
@ApiExcludeRoute()
@UseGuards(ApiKeyGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Cache(10 * 60)
  @Post('/members')
  exportClanMembers(@Body() body: ExportMembersInput): Promise<ExportMembersOutputDto> {
    return this.exportsService.exportClanMembers(body);
  }
}
