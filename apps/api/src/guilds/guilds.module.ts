import { Module } from '@nestjs/common';
import { GuildsController } from './guilds.controller';
import { GuildClansService } from './guild-clans.service';
import { GuildDiscordService } from './guild-discord.service';
import { GuildLogsService } from './guild-logs.service';
import { GuildRemindersService } from './guild-reminders.service';
import { GuildsService } from './guilds.service';
import { ReminderSchedulesService } from './reminder-schedules.service';

@Module({
  controllers: [GuildsController],
  providers: [
    GuildsService,
    GuildClansService,
    GuildDiscordService,
    GuildLogsService,
    GuildRemindersService,
    ReminderSchedulesService,
  ],
})
export class GuildsModule {}
