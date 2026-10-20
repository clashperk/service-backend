import { ReminderExclusionConfig } from '@app/collections';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { ReminderPingsDto, ReminderPingsInput } from './dto';
import { GuildDiscordService } from './guild-discord.service';

const FIELDS = {
  clanWarsRole: 'wars',
  capitalRaidsRole: 'raids',
  clanGamesRole: 'games',
} as const;

type Field = keyof typeof FIELDS;

/**
 * The ping exclusion that `/reminders config` stores in `Settings`. Reminders ping from the
 * saved member lists, which the bot keeps current as members' roles change.
 */
@Injectable()
export class GuildReminderPingsService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discord: GuildDiscordService,
  ) {}

  async get(guildId: string): Promise<ReminderPingsDto> {
    const settings = await this.settings.findOne({ guildId });
    const config = settings?.reminderExclusion;
    const role = (field: Field) => config?.[FIELDS[field]] ?? null;
    return {
      mode: config?.type ?? 'optIn',
      clanWarsRole: role('clanWarsRole'),
      capitalRaidsRole: role('capitalRaidsRole'),
      clanGamesRole: role('clanGamesRole'),
    };
  }

  async save(input: {
    guildId: string;
    applicationId: string | null;
    body: ReminderPingsInput;
  }): Promise<ReminderPingsDto> {
    const { guildId, applicationId, body } = input;
    const picked = (Object.keys(FIELDS) as Field[]).filter((field) => body[field]);

    // Without a role nothing is excluded, so the bot drops the setting.
    if (!picked.length) {
      await this.settings.updateOne({ guildId }, { $unset: { reminderExclusion: true } });
      return this.get(guildId);
    }

    const roleIds = [...new Set(picked.map((field) => body[field]!))];
    const roles = await this.discord.listRoles({ guildId, applicationId });
    if (roleIds.some((id) => !roles.some((role) => role.id === id))) {
      throw new BadRequestException('Pick roles in this server.');
    }

    const members = await this.discord.roleMembers(guildId, applicationId, roleIds);
    const config: ReminderExclusionConfig = { type: body.mode };
    for (const field of picked) {
      const key = FIELDS[field];
      config[key] = body[field]!;
      config[`${key}ExclusionUserIds`] = members.get(body[field]!)!;
    }
    await this.settings.updateOne(
      { guildId },
      { $set: { reminderExclusion: config } },
      { upsert: true },
    );
    return this.get(guildId);
  }

  private get settings() {
    return this.db.collection(Collections.SETTINGS);
  }
}
