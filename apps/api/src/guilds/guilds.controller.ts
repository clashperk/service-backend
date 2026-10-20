import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard, UserRoles } from '../auth';
import {
  CapitalRaidReminderInput,
  ClanLogDto,
  ClanLogInput,
  ClanLogType,
  ClanGamesReminderInput,
  ClanWarReminderInput,
  GuildChannelDto,
  GuildClansDto,
  GuildRemindersDto,
  GuildRoleDto,
  ListMemberDto,
  ReminderIdDto,
  ReorderClanCategoriesInput,
} from './dto';
import { GuildDiscordService } from './guild-discord.service';
import { GuildLogsService } from './guild-logs.service';
import { GuildRemindersService } from './guild-reminders.service';
import { GuildsService } from './guilds.service';

@Controller('/guilds')
@ApiBearerAuth()
@Roles([UserRoles.USER])
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuildsController {
  constructor(
    private guildsService: GuildsService,
    private guildRemindersService: GuildRemindersService,
    private guildDiscordService: GuildDiscordService,
    private guildLogsService: GuildLogsService,
  ) {}

  @Get('/:guildId/clans')
  async getGuildClans(@Param('guildId') guildId: string): Promise<GuildClansDto> {
    return this.guildsService.getGuildClans(guildId);
  }

  @Patch('/:guildId/clans/reorder')
  async reorderGuildClans(
    @Param('guildId') guildId: string,
    @Body() body: ReorderClanCategoriesInput,
  ): Promise<GuildClansDto> {
    return this.guildsService.reorderGuildClans({ categories: body.categories, guildId });
  }

  @Get('/:guildId/reminders')
  async getGuildReminders(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<GuildRemindersDto> {
    return this.guildsService.getGuildReminders({
      guildId,
      applicationId: user.applicationId || null,
    });
  }

  @Get('/:guildId/channels')
  listChannels(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<GuildChannelDto[]> {
    return this.guildDiscordService.listChannels({
      guildId,
      applicationId: user.applicationId || null,
    });
  }

  @Get('/:guildId/roles')
  listRoles(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<GuildRoleDto[]> {
    return this.guildDiscordService.listRoles({
      guildId,
      applicationId: user.applicationId || null,
    });
  }

  @Post('/:guildId/reminders/clan-wars')
  createClanWarReminder(
    @Param('guildId') guildId: string,
    @Body() body: ClanWarReminderInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ReminderIdDto> {
    return this.guildRemindersService.create('clanWars', {
      guildId,
      applicationId: user.applicationId || null,
      body,
    });
  }

  @Put('/:guildId/reminders/clan-wars/:reminderId')
  updateClanWarReminder(
    @Param('guildId') guildId: string,
    @Param('reminderId') reminderId: string,
    @Body() body: ClanWarReminderInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ReminderIdDto> {
    return this.guildRemindersService.update('clanWars', {
      guildId,
      reminderId,
      applicationId: user.applicationId || null,
      body,
    });
  }

  @Delete('/:guildId/reminders/clan-wars/:reminderId')
  @HttpCode(204)
  async deleteClanWarReminder(
    @Param('guildId') guildId: string,
    @Param('reminderId') reminderId: string,
  ): Promise<void> {
    await this.guildRemindersService.delete('clanWars', { guildId, reminderId });
  }

  @Post('/:guildId/reminders/capital-raids')
  createCapitalRaidReminder(
    @Param('guildId') guildId: string,
    @Body() body: CapitalRaidReminderInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ReminderIdDto> {
    return this.guildRemindersService.create('capitalRaids', {
      guildId,
      applicationId: user.applicationId || null,
      body,
    });
  }

  @Put('/:guildId/reminders/capital-raids/:reminderId')
  updateCapitalRaidReminder(
    @Param('guildId') guildId: string,
    @Param('reminderId') reminderId: string,
    @Body() body: CapitalRaidReminderInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ReminderIdDto> {
    return this.guildRemindersService.update('capitalRaids', {
      guildId,
      reminderId,
      applicationId: user.applicationId || null,
      body,
    });
  }

  @Delete('/:guildId/reminders/capital-raids/:reminderId')
  @HttpCode(204)
  async deleteCapitalRaidReminder(
    @Param('guildId') guildId: string,
    @Param('reminderId') reminderId: string,
  ): Promise<void> {
    await this.guildRemindersService.delete('capitalRaids', { guildId, reminderId });
  }

  @Post('/:guildId/reminders/clan-games')
  createClanGamesReminder(
    @Param('guildId') guildId: string,
    @Body() body: ClanGamesReminderInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ReminderIdDto> {
    return this.guildRemindersService.create('clanGames', {
      guildId,
      applicationId: user.applicationId || null,
      body,
    });
  }

  @Put('/:guildId/reminders/clan-games/:reminderId')
  updateClanGamesReminder(
    @Param('guildId') guildId: string,
    @Param('reminderId') reminderId: string,
    @Body() body: ClanGamesReminderInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ReminderIdDto> {
    return this.guildRemindersService.update('clanGames', {
      guildId,
      reminderId,
      applicationId: user.applicationId || null,
      body,
    });
  }

  @Delete('/:guildId/reminders/clan-games/:reminderId')
  @HttpCode(204)
  async deleteClanGamesReminder(
    @Param('guildId') guildId: string,
    @Param('reminderId') reminderId: string,
  ): Promise<void> {
    await this.guildRemindersService.delete('clanGames', { guildId, reminderId });
  }

  @Get('/:guildId/clans/:clanTag/logs')
  listClanLogs(
    @Param('guildId') guildId: string,
    @Param('clanTag') clanTag: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ClanLogDto[]> {
    return this.guildLogsService.list({
      guildId,
      clanTag,
      applicationId: user.applicationId || null,
    });
  }

  @Put('/:guildId/clans/:clanTag/logs/:logType')
  @ApiParam({ name: 'logType', enum: ClanLogType, enumName: 'ClanLogType' })
  saveClanLog(
    @Param('guildId') guildId: string,
    @Param('clanTag') clanTag: string,
    @Param('logType', new ParseEnumPipe(ClanLogType)) logType: ClanLogType,
    @Body() body: ClanLogInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ClanLogDto> {
    return this.guildLogsService.save({
      guildId,
      clanTag,
      logType,
      body,
      applicationId: user.applicationId || null,
    });
  }

  @Delete('/:guildId/clans/:clanTag/logs/:logType')
  @ApiParam({ name: 'logType', enum: ClanLogType, enumName: 'ClanLogType' })
  @HttpCode(204)
  async deleteClanLog(
    @Param('guildId') guildId: string,
    @Param('clanTag') clanTag: string,
    @Param('logType', new ParseEnumPipe(ClanLogType)) logType: ClanLogType,
  ): Promise<void> {
    await this.guildLogsService.delete({ guildId, clanTag, logType });
  }

  @Get('/:guildId/members/list')
  async listMembers(
    @Param('guildId') guildId: string,
    @Query('query') query: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ListMemberDto[]> {
    return this.guildsService.listMembers({
      guildId,
      query,
      applicationId: user.applicationId || null,
    });
  }
}
