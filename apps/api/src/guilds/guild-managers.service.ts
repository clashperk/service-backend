import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { ManagerRolesDto, ManagerRolesInput } from './dto';
import { GuildDiscordService } from './guild-discord.service';
import { MANAGER_ROLE_KEYS, toRoleIds } from './manager-roles';

type Field = keyof typeof MANAGER_ROLE_KEYS;
const FIELDS = Object.keys(MANAGER_ROLE_KEYS) as Field[];

/** Manager roles as `/config` stores them in `Settings`, which the bot reloads on change. */
@Injectable()
export class GuildManagersService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discord: GuildDiscordService,
  ) {}

  async get(guildId: string): Promise<ManagerRolesDto> {
    const settings = await this.settings.findOne({ guildId });
    const read = (field: Field) => toRoleIds(settings?.[MANAGER_ROLE_KEYS[field]]);
    return {
      managerRoles: read('managerRoles'),
      rosterManagerRoles: read('rosterManagerRoles'),
      flagsManagerRoles: read('flagsManagerRoles'),
      linksManagerRoles: read('linksManagerRoles'),
    };
  }

  async save(input: {
    guildId: string;
    applicationId: string | null;
    body: ManagerRolesInput;
  }): Promise<ManagerRolesDto> {
    const { guildId, body } = input;
    const set: Record<string, string[]> = {};
    const unset: Record<string, true> = {};
    for (const field of FIELDS) {
      const roles = body[field];
      if (!roles) continue;
      // The bot drops the setting when no roles are left, as `/config` does.
      if (roles.length) set[MANAGER_ROLE_KEYS[field]] = [...new Set(roles)];
      else unset[MANAGER_ROLE_KEYS[field]] = true;
    }

    const picked = new Set(Object.values(set).flat());
    if (picked.size) {
      const roles = await this.discord.listRoles({ guildId, applicationId: input.applicationId });
      const known = new Set(roles.map((role) => role.id));
      if ([...picked].some((id) => !known.has(id))) {
        throw new BadRequestException('Pick roles in this server.');
      }
    }

    if (Object.keys(set).length || Object.keys(unset).length) {
      await this.settings.updateOne(
        { guildId },
        {
          ...(Object.keys(set).length ? { $set: set } : {}),
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
        { upsert: true },
      );
    }
    return this.get(guildId);
  }

  private get settings() {
    return this.db.collection(Collections.SETTINGS);
  }
}
