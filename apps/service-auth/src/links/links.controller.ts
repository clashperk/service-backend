import { CurrentUser, JwtAuthGuard, Role, Roles, RolesGuard } from '@app/auth';
import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BulkLinksDto, CreateLinkInput, DeleteLinkInput } from './dto';
import { LinksService } from './links.service';

@ApiTags('LINKS')
@Controller('/links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LinksController {
  constructor(private linksService: LinksService) {}

  @Get('/:userIdOrTag')
  getLink(@Param('userIdOrTag') userIdOrTag: string) {
    return this.linksService.getLinksById(userIdOrTag);
  }

  @Post('/bulk')
  @HttpCode(200)
  getLinks(@Body() body: BulkLinksDto) {
    return this.linksService.getLinks(body.input);
  }

  @Post('/')
  @Roles(Role.USER)
  @ApiOperation({ summary: '(Internal)' })
  async createLink(@Body() body: CreateLinkInput) {
    return this.linksService.createLink(body);
  }

  @Delete('/')
  @Roles(Role.USER)
  @ApiOperation({ summary: '(Internal)' })
  async deleteLink(@CurrentUser() userId: string, @Body() body: DeleteLinkInput) {
    return this.linksService.deleteLink(userId, body);
  }
}
