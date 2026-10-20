import { Module } from '@nestjs/common';
import { GuildsController } from './guilds.controller';
import { GuildDiscordService } from './guild-discord.service';
import { GuildRemindersService } from './guild-reminders.service';
import { GuildsService } from './guilds.service';
import { ReminderSchedulesService } from './reminder-schedules.service';

@Module({
  controllers: [GuildsController],
  providers: [GuildsService, GuildDiscordService, GuildRemindersService, ReminderSchedulesService],
})
export class GuildsModule {}
