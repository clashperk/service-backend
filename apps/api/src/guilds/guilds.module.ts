import { Module } from '@nestjs/common';
import { GuildsController } from './guilds.controller';
import { GuildTicketsController } from './guild-tickets.controller';
import { GuildTicketsService } from './guild-tickets.service';
import { GuildAutoRolesService } from './guild-auto-roles.service';
import { GuildClansService } from './guild-clans.service';
import { GuildConfigService } from './guild-config.service';
import { GuildFlagsService } from './guild-flags.service';
import { GuildDiscordService } from './guild-discord.service';
import { GuildLogsService } from './guild-logs.service';
import { GuildManagersService } from './guild-managers.service';
import { GuildRemindersService } from './guild-reminders.service';
import { GuildButtonsService } from './guild-buttons.service';
import { GuildServerLogsService } from './guild-server-logs.service';
import { GuildsService } from './guilds.service';
import { ReminderSchedulesService } from './reminder-schedules.service';

@Module({
  controllers: [GuildsController, GuildTicketsController],
  providers: [
    GuildsService,
    GuildAutoRolesService,
    GuildClansService,
    GuildConfigService,
    GuildDiscordService,
    GuildFlagsService,
    GuildLogsService,
    GuildManagersService,
    GuildTicketsService,
    GuildServerLogsService,
    GuildButtonsService,
    GuildRemindersService,
    ReminderSchedulesService,
  ],
})
export class GuildsModule {}
