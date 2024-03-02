import { CurrentUser, JwtAuthGuard, JwtUser } from '@app/auth';
import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BulkLinksDto } from './dto/bulk-links.dto';
import { CreateLinkInput } from './dto/create-links.dto';
import { DeleteLinkInput } from './dto/delete-link.dto';
import { LinksService } from './links.service';

@ApiTags('LINKS')
@Controller('/links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor(private linksService: LinksService) {}

  @Post('/')
  async createLink(@Body() body: CreateLinkInput) {
    return this.linksService.createLink(body);
  }

  @Delete('/')
  async deleteLink(@CurrentUser() user: JwtUser, @Body() body: DeleteLinkInput) {
    return this.linksService.deleteLink(user.sub, body);
  }

  @Get('/:userIdOrTag')
  getLink(@Param('userIdOrTag') userIdOrTag: string) {
    return this.linksService.getLink(userIdOrTag);
  }

  @Post('/bulk')
  @HttpCode(200)
  getLinks(@Body() body: BulkLinksDto) {
    return this.linksService.getLinks(body.input);
  }
}
