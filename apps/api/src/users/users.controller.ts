import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard, UserRoles } from '../auth';
import { ClanTagInput, TimezoneInput, UserSettingsDto } from './dto/user-settings.dto';
import { UsersService } from './users.service';
import { ApiTag } from '../api-tags';

/** The signed-in user's bot settings; the bot can call these for the member who ran a command. */
@ApiTags(ApiTag.USERS)
@Controller('/users/me')
@ApiBearerAuth()
@Roles([UserRoles.USER])
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUserSettings(@CurrentUser() user: JwtUser): Promise<UserSettingsDto> {
    return this.usersService.getSettings(user.userId);
  }

  @Put('/clan')
  setDefaultClan(
    @CurrentUser() user: JwtUser,
    @Body() body: ClanTagInput,
  ): Promise<UserSettingsDto> {
    return this.usersService.setDefaultClan(user.userId, body.clanTag);
  }

  @Delete('/clan')
  clearDefaultClan(@CurrentUser() user: JwtUser): Promise<UserSettingsDto> {
    return this.usersService.clearDefaultClan(user.userId);
  }

  @Post('/bookmarks')
  addBookmark(@CurrentUser() user: JwtUser, @Body() body: ClanTagInput): Promise<UserSettingsDto> {
    return this.usersService.addBookmark(user.userId, body.clanTag);
  }

  @Delete('/bookmarks/:clanTag')
  removeBookmark(
    @CurrentUser() user: JwtUser,
    @Param('clanTag') clanTag: string,
  ): Promise<UserSettingsDto> {
    return this.usersService.removeBookmark(user.userId, clanTag);
  }

  @Put('/timezone')
  setTimezone(@CurrentUser() user: JwtUser, @Body() body: TimezoneInput): Promise<UserSettingsDto> {
    return this.usersService.setTimezone(user.userId, body.id);
  }

  @Delete('/timezone')
  clearTimezone(@CurrentUser() user: JwtUser): Promise<UserSettingsDto> {
    return this.usersService.clearTimezone(user.userId);
  }
}
