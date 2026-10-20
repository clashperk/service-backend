import { Module } from '@nestjs/common';
import { GuildsController } from './guilds.controller';
import { GuildAutoRolesService } from './guild-auto-roles.service';
import { GuildClansService } from './guild-clans.service';
import { GuildFlagsService } from './guild-flags.service';
import { GuildDiscordService } from './guild-discord.service';
import { GuildLogsService } from './guild-logs.service';
import { GuildRemindersService } from './guild-reminders.service';
import { GuildsService } from './guilds.service';
import { ReminderSchedulesService } from './reminder-schedules.service';

@Module({
  controllers: [GuildsController],
  providers: [
    GuildsService,
    GuildAutoRolesService,
    GuildClansService,
    GuildDiscordService,
    GuildFlagsService,
    GuildLogsService,
    GuildRemindersService,
    ReminderSchedulesService,
  ],
})
export class GuildsModule {}
