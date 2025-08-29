import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { codeBlock } from '../app.constants';
import { JwtAuthGuard } from '../auth/guards';
import { BulkLinksInputDto, LinksDto } from './dto';
import { LinksService } from './links.service';

@Controller('/links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor(private linksService: LinksService) {}

  @Post('/search')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get links by playerTags or userIds',
    description: codeBlock(
      `You can send either "playerTags" or "userIds", not both or none. Max size is 100.`,
    ),
  })
  getLinksByUserIds(@Body() input: BulkLinksInputDto): Promise<LinksDto[]> {
    if (input.playerTags?.length) {
      return this.linksService.getLinksByPlayerTags(input.playerTags);
    }
    return this.linksService.getLinksByUserIds(input.userIds);
  }
}
