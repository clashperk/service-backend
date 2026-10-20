import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import {
  AutoRoleClanInput,
  AutoRolesDto,
  AutoRolesInput,
  DelayExclusion,
  NicknameAccount,
} from './dto';
import { GuildDiscordService } from './guild-discord.service';

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${from + i}`);

// The keys the bot reads; see `TOWN_HALL_LEVELS_FOR_ROLES` and `PLAYER_LEAGUE_MAPS` in the bot.
const TOWN_HALLS = range(1, 18);
const BUILDER_HALLS = range(1, 10);
const LEAGUES = [
  'unranked',
  'skeleton',
  'barbarian',
  'archer',
  'wizard',
  'valkyrie',
  'witch',
  'golem',
  'pekka',
  'titan',
  'dragon',
  'electro',
  'legend_3',
  'legend_2',
  'legend',
];
const BUILDER_LEAGUES = [
  'wood',
  'clay',
  'stone',
  'copper',
  'brass',
  'iron',
  'steel',
  'titanium',
  'platinum',
  'emerald',
  'ruby',
  'diamond',
];
const TROPHY_RANGES = ['5200_5249', '5250_5499', '5500_5749', '5750_5999', '6000_8000'];

const MAPS = {
  townHall: { key: 'townHallRoles', keys: TOWN_HALLS, label: 'Town Hall level' },
  builderHall: { key: 'builderHallRoles', keys: BUILDER_HALLS, label: 'Builder Hall level' },
  leagues: { key: 'leagueRoles', keys: LEAGUES, label: 'league' },
  builderLeagues: { key: 'builderLeagueRoles', keys: BUILDER_LEAGUES, label: 'builder league' },
  trophies: { key: 'trophyRoles', keys: TROPHY_RANGES, label: 'trophy range' },
} as const;

const SINGLE_ROLES = {
  familyRole: 'familyRole',
  exclusiveFamilyRole: 'exclusiveFamilyRole',
  guestRole: 'guestRole',
  verifiedRole: 'accountVerifiedRole',
  linkedRole: 'accountLinkedRole',
} as const;

const FLAGS = {
  allowNonFamilyTownHall: 'allowExternalAccounts',
  allowNonFamilyLeagues: 'allowExternalAccountsLeague',
  verifiedOnlyClanRoles: 'verifiedOnlyClanRoles',
  autoUpdate: 'useAutoRole',
  forceRefresh: 'forceRefreshRoles',
  allowNotLinked: 'autoRoleAllowNotLinked',
} as const;

// A nickname needs a name in it; a non-family one can't mention clans or clan roles.
const NAME_PLACEHOLDER =
  /{NAME}|{PLAYER_NAME}|{DISCORD_NAME}|{DISCORD_USERNAME}|{USERNAME}|{DISCORD}/i;
const CLAN_PLACEHOLDER =
  /{CLAN}|{CLAN_NAME}|{ALIAS}|{CLAN_ALIAS}|{ALIASES}|{CLAN_ALIASES}|{ROLE}|{CLAN_ROLE}/i;

type TrophyRole = { key: string; min: number; max: number; roleId: string };
type ClanRoles = Partial<Record<'leader' | 'coLeader' | 'admin' | 'member' | 'everyone', string>>;

/**
 * Auto-roles as `/autorole` stores them: server-wide maps in `Settings`, which the bot reloads on
 * change, and per-clan roles on `ClanStores`, which it reads fresh. Roles update on its next check.
 */
@Injectable()
export class GuildAutoRolesService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discord: GuildDiscordService,
  ) {}

  async get(guildId: string): Promise<AutoRolesDto> {
    const [settings, clans] = await Promise.all([
      this.settings.findOne({ guildId }),
      this.clans
        .find(
          { guild: guildId },
          {
            projection: { tag: 1, name: 1, roles: 1, warRole: 1, secureRole: 1 },
            sort: { order: 1 },
          },
        )
        .toArray(),
    ]);
    const s = (settings ?? {}) as Record<string, unknown>;
    const trophies = (s.trophyRoles ?? {}) as Record<string, TrophyRole>;
    const exclusions = (s.delayExclusionList ?? {}) as Record<string, boolean>;
    const labels = (s.roleReplacementLabels ?? {}) as Partial<Record<string, string>>;

    return {
      townHall: (s.townHallRoles ?? {}) as Record<string, string>,
      builderHall: (s.builderHallRoles ?? {}) as Record<string, string>,
      leagues: (s.leagueRoles ?? {}) as Record<string, string>,
      builderLeagues: (s.builderLeagueRoles ?? {}) as Record<string, string>,
      trophies: Object.fromEntries(
        Object.entries(trophies).map(([key, value]) => [key, value.roleId]),
      ),
      familyRole: (s.familyRole as string) ?? null,
      exclusiveFamilyRole: (s.exclusiveFamilyRole as string) ?? null,
      familyLeadersRoles: (s.familyLeadersRole as string[]) ?? [],
      guestRole: (s.guestRole as string) ?? null,
      verifiedRole: (s.accountVerifiedRole as string) ?? null,
      linkedRole: (s.accountLinkedRole as string) ?? null,
      eosPushRole: (s.eosPushClanRoles as string[] | undefined)?.[0] ?? null,
      eosPushClans: (s.eosPushClans as string[]) ?? [],
      allowNonFamilyTownHall: s.allowExternalAccounts === true,
      allowNonFamilyLeagues: s.allowExternalAccountsLeague === true,
      // Before the setting existed, `secureRole` on a clan meant the same thing.
      verifiedOnlyClanRoles:
        typeof s.verifiedOnlyClanRoles === 'boolean'
          ? s.verifiedOnlyClanRoles
          : clans.some((clan) => clan.secureRole),
      autoUpdate: s.useAutoRole !== false,
      forceRefresh: s.forceRefreshRoles === true,
      allowNotLinked: s.autoRoleAllowNotLinked !== false,
      removalDelay: (s.roleRemovalDelays as number) ?? 0,
      additionDelay: (s.roleAdditionDelays as number) ?? 0,
      delayExclusions: Object.values(DelayExclusion).filter((key) => exclusions[key]),
      familyNicknameFormat: (s.familyNicknameFormat as string) ?? '',
      nonFamilyNicknameFormat: (s.nonFamilyNicknameFormat as string) ?? '',
      autoNickname: s.autoNickname === true,
      nicknameAccount:
        (s.nicknamingAccountPreference as NicknameAccount) ?? NicknameAccount.DEFAULT_OR_BEST,
      nicknameRoleLabels: {
        leader: labels.leader ?? '',
        coLeader: labels.coLeader ?? '',
        elder: labels.admin ?? '',
        member: labels.member ?? '',
      },
      clans: clans.map((clan) => {
        const roles = (clan.roles ?? {}) as ClanRoles;
        return {
          tag: clan.tag,
          name: clan.name,
          leader: roles.leader ?? null,
          coLeader: roles.coLeader ?? null,
          elder: roles.admin ?? null,
          member: roles.member ?? null,
          everyone: roles.everyone ?? null,
          warRole: (clan.warRole as string) ?? null,
        };
      }),
    };
  }

  async save(input: {
    guildId: string;
    applicationId: string | null;
    body: AutoRolesInput;
  }): Promise<AutoRolesDto> {
    const { guildId, body } = input;
    const setsRoles = [
      ...Object.keys(MAPS),
      ...Object.keys(SINGLE_ROLES),
      'familyLeadersRoles',
      'allowNonFamilyTownHall',
      'allowNonFamilyLeagues',
    ].some((field) => body[field as keyof AutoRolesInput] !== undefined);
    if (setsRoles) await this.requireClans(guildId);

    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    const roleIds: string[] = [];
    const put = (key: string, value: unknown, off: boolean) => {
      if (off) unset[key] = '';
      else set[key] = value;
    };

    for (const [field, { key, keys, label }] of Object.entries(MAPS)) {
      const map = body[field as keyof typeof MAPS];
      if (map === undefined) continue;
      for (const [entry, roleId] of Object.entries(map)) {
        if (!(keys as readonly string[]).includes(entry)) {
          throw new BadRequestException(`${entry} isn't a ${label} the bot has roles for.`);
        }
        if (typeof roleId !== 'string' || !/^\d{17,20}$/.test(roleId)) {
          throw new BadRequestException(`Pick a role for ${entry}.`);
        }
        roleIds.push(roleId);
      }
      const value =
        field === 'trophies'
          ? Object.fromEntries(
              Object.entries(map).map(([entry, roleId]) => {
                const [min, max] = entry.split('_').map(Number);
                return [entry, { key: entry, min, max, roleId }];
              }),
            )
          : map;
      put(key, value, Object.keys(map).length === 0);
    }

    for (const [field, key] of Object.entries(SINGLE_ROLES)) {
      const roleId = body[field as keyof typeof SINGLE_ROLES];
      if (roleId === undefined) continue;
      if (roleId) roleIds.push(roleId);
      put(key, roleId, roleId === null);
    }
    if (body.familyLeadersRoles) {
      const roles = [...new Set(body.familyLeadersRoles)];
      roleIds.push(...roles);
      put('familyLeadersRole', roles, roles.length === 0);
    }

    if (body.eosPushRole !== undefined) {
      if (body.eosPushRole) roleIds.push(body.eosPushRole);
      put('eosPushClanRoles', [body.eosPushRole], body.eosPushRole === null);
    }
    if (body.eosPushClans) {
      const tags = [...new Set(body.eosPushClans)];
      const found = await this.clans.countDocuments({ guild: guildId, tag: { $in: tags } });
      if (found !== tags.length) {
        throw new BadRequestException('Pick clans that are added to this server.');
      }
      set.eosPushClans = tags;
    }

    for (const [field, key] of Object.entries(FLAGS)) {
      const value = body[field as keyof typeof FLAGS];
      if (value !== undefined) set[key] = value;
    }
    if (body.removalDelay !== undefined) set.roleRemovalDelays = body.removalDelay;
    if (body.additionDelay !== undefined) set.roleAdditionDelays = body.additionDelay;
    if (body.delayExclusions) {
      // The bot only ever stores `true`; a key that's off is left out.
      set.delayExclusionList = Object.fromEntries(body.delayExclusions.map((key) => [key, true]));
    }

    const family = body.familyNicknameFormat;
    if (family !== undefined) {
      if (family && !NAME_PLACEHOLDER.test(family)) {
        throw new BadRequestException(
          'The family nickname needs {PLAYER_NAME}, {DISCORD_NAME} or {DISCORD_USERNAME}.',
        );
      }
      set.familyNicknameFormat = family;
    }
    const nonFamily = body.nonFamilyNicknameFormat;
    if (nonFamily !== undefined) {
      if (nonFamily && CLAN_PLACEHOLDER.test(nonFamily)) {
        throw new BadRequestException(
          "The non-family nickname can't use clan placeholders: {CLAN}, {ALIAS}, {ALIASES} or {ROLE}.",
        );
      }
      if (nonFamily && !NAME_PLACEHOLDER.test(nonFamily)) {
        throw new BadRequestException(
          'The non-family nickname needs {PLAYER_NAME}, {DISCORD_NAME} or {DISCORD_USERNAME}.',
        );
      }
      set.nonFamilyNicknameFormat = nonFamily;
    }
    if (body.autoNickname !== undefined) set.autoNickname = body.autoNickname;
    if (body.nicknameAccount) set.nicknamingAccountPreference = body.nicknameAccount;
    if (body.nicknameRoleLabels) {
      const { leader, coLeader, elder, member } = body.nicknameRoleLabels;
      // The bot always writes all four, blank ones as "".
      set.roleReplacementLabels = { leader, coLeader, admin: elder, member };
    }

    await this.discord.checkAssignableRoles(guildId, input.applicationId, roleIds);
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

  async saveClan(input: {
    guildId: string;
    applicationId: string | null;
    clanTag: string;
    body: AutoRoleClanInput;
  }): Promise<AutoRolesDto> {
    const { guildId, body } = input;
    const clan = await this.clans.findOne({ guild: guildId, tag: input.clanTag });
    if (!clan) throw new NotFoundException('That clan is not added to this server.');

    if (body.warRole) {
      const shared = await this.clans.findOne({
        guild: guildId,
        warRole: body.warRole,
        _id: { $ne: clan._id },
      });
      if (shared) {
        throw new BadRequestException(`That in-war role is already used by ${shared.name}.`);
      }
    }

    const roles = Object.fromEntries(
      Object.entries({
        leader: body.leader,
        coLeader: body.coLeader,
        admin: body.elder,
        member: body.member,
        everyone: body.everyone,
      }).filter(([, roleId]) => roleId),
    ) as ClanRoles;
    await this.discord.checkAssignableRoles(guildId, input.applicationId, [
      ...Object.values(roles),
      ...(body.warRole ? [body.warRole] : []),
    ] as string[]);

    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    if (Object.keys(roles).length) set.roles = roles;
    else unset.roles = '';
    if (body.warRole) set.warRole = body.warRole;
    else unset.warRole = '';
    await this.clans.updateOne(
      { _id: clan._id },
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
    );
    return this.get(guildId);
  }

  /** The bot's role commands need a clan first; its options and nicknames don't. */
  private async requireClans(guildId: string) {
    if (!(await this.clans.findOne({ guild: guildId }, { projection: { _id: 1 } }))) {
      throw new BadRequestException('Add a clan to this server first.');
    }
  }

  private get settings() {
    return this.db.collection(Collections.SETTINGS);
  }

  private get clans() {
    return this.db.collection(Collections.CLAN_STORES);
  }
}
