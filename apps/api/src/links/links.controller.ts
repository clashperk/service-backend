import { ResultOkDto } from '@app/dto';
import { codeBlock } from '@app/helpers';
import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard, UserRoles } from '../auth';
import { CreateLinkInputDto, GetLinksInputDto, LinksDto } from './dto';
import { LinksService } from './links.service';

@Controller('/links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LinksController {
  constructor(private linksService: LinksService) {}

  @Post('/')
  @Roles([UserRoles.MANAGE_LINKS])
  async link(@CurrentUser() user: JwtUser, @Body() body: CreateLinkInputDto): Promise<ResultOkDto> {
    return this.linksService.createLink(user.userId, body);
  }

  @Delete('/:playerTag')
  @Roles([UserRoles.MANAGE_LINKS])
  async unlink(
    @CurrentUser() user: JwtUser,
    @Param('playerTag') playerTag: string,
  ): Promise<ResultOkDto> {
    return this.linksService.deleteLink({
      playerTag,
      userId: user.userId,
      isAdmin: JwtUser.isAdmin(user),
    });
  }

  @Post('/query')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get links by playerTags or userIds',
    description: codeBlock(
      `You can send either "playerTags" or "userIds", not both or none. Max size is 100.`,
    ),
  })
  @Roles([UserRoles.USER, UserRoles.FETCH_LINKS, UserRoles.MANAGE_LINKS])
  async getLinks(@Body() input: GetLinksInputDto): Promise<LinksDto[]> {
    if (input.playerTags?.length) {
      return this.linksService.getLinksByPlayerTags(input.playerTags);
    }
    return this.linksService.getLinksByUserIds(input.userIds);
  }
}
