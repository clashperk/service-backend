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
import { ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard, UserRoles } from '../auth';
import {
  AddGuildClanInput,
  FlagDto,
  FlagInput,
  FlagsDto,
  FlagType,
  AutoRoleClanInput,
  AutoRolesDto,
  AutoRolesInput,
  ClanSettingsInput,
  CapitalRaidReminderInput,
  ClanCategoryInput,
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
  ManagerRolesDto,
  ManagerRolesInput,
  FlagAlertLogInput,
  MaintenanceLogInput,
  ServerLogChannelInput,
  ServerLogsDto,
  WelcomeLogInput,
} from './dto';
import { GuildAutoRolesService } from './guild-auto-roles.service';
import { GuildClansService } from './guild-clans.service';
import { GuildFlagsService } from './guild-flags.service';
import { GuildDiscordService } from './guild-discord.service';
import { GuildLogsService } from './guild-logs.service';
import { GuildManagersService } from './guild-managers.service';
import { GuildRemindersService } from './guild-reminders.service';
import { GuildServerLogsService } from './guild-server-logs.service';
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
    private guildClansService: GuildClansService,
    private guildAutoRolesService: GuildAutoRolesService,
    private guildFlagsService: GuildFlagsService,
    private guildServerLogsService: GuildServerLogsService,
    private guildManagersService: GuildManagersService,
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

  @Post('/:guildId/clans')
  addGuildClan(
    @Param('guildId') guildId: string,
    @Body() body: AddGuildClanInput,
    @CurrentUser() user: JwtUser,
  ): Promise<GuildClansDto> {
    return this.guildClansService.add({
      guildId,
      body,
      userId: user.userId,
      applicationId: user.applicationId || null,
    });
  }

  @Delete('/:guildId/clans/:clanTag')
  removeGuildClan(
    @Param('guildId') guildId: string,
    @Param('clanTag') clanTag: string,
  ): Promise<GuildClansDto> {
    return this.guildClansService.remove({ guildId, clanTag });
  }

  @Patch('/:guildId/clans/:clanTag')
  updateGuildClan(
    @Param('guildId') guildId: string,
    @Param('clanTag') clanTag: string,
    @Body() body: ClanSettingsInput,
    @CurrentUser() user: JwtUser,
  ): Promise<GuildClansDto> {
    return this.guildClansService.updateSettings({
      guildId,
      clanTag,
      body,
      applicationId: user.applicationId || null,
    });
  }

  @Post('/:guildId/categories')
  createClanCategory(
    @Param('guildId') guildId: string,
    @Body() body: ClanCategoryInput,
  ): Promise<GuildClansDto> {
    return this.guildClansService.createCategory(guildId, body.name);
  }

  @Patch('/:guildId/categories/:categoryId')
  renameClanCategory(
    @Param('guildId') guildId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: ClanCategoryInput,
  ): Promise<GuildClansDto> {
    return this.guildClansService.renameCategory(guildId, categoryId, body.name);
  }

  @Delete('/:guildId/categories/:categoryId')
  deleteClanCategory(
    @Param('guildId') guildId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<GuildClansDto> {
    return this.guildClansService.deleteCategory(guildId, categoryId);
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

  @Get('/:guildId/auto-roles')
  getAutoRoles(@Param('guildId') guildId: string): Promise<AutoRolesDto> {
    return this.guildAutoRolesService.get(guildId);
  }

  @Patch('/:guildId/auto-roles')
  saveAutoRoles(
    @Param('guildId') guildId: string,
    @Body() body: AutoRolesInput,
    @CurrentUser() user: JwtUser,
  ): Promise<AutoRolesDto> {
    return this.guildAutoRolesService.save({
      guildId,
      body,
      applicationId: user.applicationId || null,
    });
  }

  @Put('/:guildId/auto-roles/clans/:clanTag')
  saveClanAutoRoles(
    @Param('guildId') guildId: string,
    @Param('clanTag') clanTag: string,
    @Body() body: AutoRoleClanInput,
    @CurrentUser() user: JwtUser,
  ): Promise<AutoRolesDto> {
    return this.guildAutoRolesService.saveClan({
      guildId,
      clanTag,
      body,
      applicationId: user.applicationId || null,
    });
  }

  @Get('/:guildId/flags')
  @ApiQuery({ name: 'flagType', enum: FlagType, enumName: 'FlagType', required: false })
  listFlags(
    @Param('guildId') guildId: string,
    @Query('flagType', new ParseEnumPipe(FlagType, { optional: true })) flagType?: FlagType,
  ): Promise<FlagsDto> {
    return this.guildFlagsService.list(guildId, flagType);
  }

  @Post('/:guildId/flags')
  createFlags(
    @Param('guildId') guildId: string,
    @Body() body: FlagInput,
    @CurrentUser() user: JwtUser,
  ): Promise<FlagDto[]> {
    return this.guildFlagsService.create({ guildId, body, userId: user.userId });
  }

  @Delete('/:guildId/flags/:flagId')
  @HttpCode(204)
  async deleteFlag(
    @Param('guildId') guildId: string,
    @Param('flagId') flagId: string,
  ): Promise<void> {
    await this.guildFlagsService.delete({ guildId, flagId });
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

  @Get('/:guildId/server-logs')
  getServerLogs(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ServerLogsDto> {
    return this.guildServerLogsService.get(guildId, user.applicationId || null);
  }

  @Put('/:guildId/server-logs/flag-alert')
  saveFlagAlertLog(
    @Param('guildId') guildId: string,
    @Body() body: FlagAlertLogInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ServerLogsDto> {
    return this.guildServerLogsService.saveFlagAlert({
      guildId,
      body,
      applicationId: user.applicationId || null,
    });
  }

  @Delete('/:guildId/server-logs/flag-alert')
  deleteFlagAlertLog(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ServerLogsDto> {
    return this.guildServerLogsService.deleteFlagAlert(guildId, user.applicationId || null);
  }

  @Put('/:guildId/server-logs/roster-changelog')
  saveRosterChangelog(
    @Param('guildId') guildId: string,
    @Body() body: ServerLogChannelInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ServerLogsDto> {
    return this.guildServerLogsService.saveRosterChangelog({
      guildId,
      body,
      applicationId: user.applicationId || null,
    });
  }

  @Delete('/:guildId/server-logs/roster-changelog')
  deleteRosterChangelog(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ServerLogsDto> {
    return this.guildServerLogsService.delete(
      guildId,
      user.applicationId || null,
      'rosterChangeLog',
    );
  }

  @Put('/:guildId/server-logs/maintenance')
  saveMaintenanceLog(
    @Param('guildId') guildId: string,
    @Body() body: MaintenanceLogInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ServerLogsDto> {
    return this.guildServerLogsService.saveMaintenance({
      guildId,
      body,
      applicationId: user.applicationId || null,
    });
  }

  @Delete('/:guildId/server-logs/maintenance')
  deleteMaintenanceLog(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ServerLogsDto> {
    return this.guildServerLogsService.delete(guildId, user.applicationId || null, 'eventsChannel');
  }

  @Put('/:guildId/server-logs/welcome')
  saveWelcomeLog(
    @Param('guildId') guildId: string,
    @Body() body: WelcomeLogInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ServerLogsDto> {
    return this.guildServerLogsService.saveWelcome({
      guildId,
      body,
      applicationId: user.applicationId || null,
    });
  }

  /** Turns the welcome message off but keeps it, as `/setup server-logs disable` does. */
  @Delete('/:guildId/server-logs/welcome')
  deleteWelcomeLog(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ServerLogsDto> {
    return this.guildServerLogsService.delete(guildId, user.applicationId || null, 'welcomeLog');
  }

  @Get('/:guildId/managers')
  getManagerRoles(@Param('guildId') guildId: string): Promise<ManagerRolesDto> {
    return this.guildManagersService.get(guildId);
  }

  @Patch('/:guildId/managers')
  saveManagerRoles(
    @Param('guildId') guildId: string,
    @Body() body: ManagerRolesInput,
    @CurrentUser() user: JwtUser,
  ): Promise<ManagerRolesDto> {
    return this.guildManagersService.save({
      guildId,
      body,
      applicationId: user.applicationId || null,
    });
  }
}
