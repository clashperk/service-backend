import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Collections } from '../db';
import { AutoRolesInput, DelayExclusion } from './dto';
import { GuildAutoRolesService } from './guild-auto-roles.service';
import { GuildDiscordService } from './guild-discord.service';

jest.mock('@app/discord-oauth', () => ({ DiscordOauthService: class {} }));

const GUILD = '111111111111111111';
const TAG = '#2PC9YQL0Q';
const ROLE = (n: number) => `22222222222222222${n}`;

type Doc = Record<string, unknown>;

const setup = (opts: { settings?: Doc; clans?: Doc[] } = {}) => {
  const settings: Doc[] = opts.settings ? [{ guildId: GUILD, ...opts.settings }] : [];
  const clans: Doc[] = opts.clans ?? [
    { _id: new ObjectId(), guild: GUILD, tag: TAG, name: 'Pugs' },
  ];
  const writes: { collection: string; update: Record<string, Doc> }[] = [];
  const apply = (doc: Doc, update: Record<string, Doc>) => {
    Object.assign(doc, update.$set ?? {});
    for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
  };
  const matches = (doc: Doc, filter: Doc) =>
    Object.entries(filter).every(([key, cond]) => {
      const value = doc[key];
      if (cond && typeof cond === 'object' && !(cond instanceof ObjectId)) {
        const op = cond as Doc;
        if ('$in' in op) return (op.$in as unknown[]).includes(value);
        if ('$ne' in op) return !(op.$ne as ObjectId).equals(value as ObjectId);
      }
      return cond instanceof ObjectId ? cond.equals(value as ObjectId) : value === cond;
    });
  const collection = (name: Collections) => {
    const docs = name === Collections.SETTINGS ? settings : clans;
    return {
      findOne: (filter: Doc) => Promise.resolve(docs.find((doc) => matches(doc, filter)) ?? null),
      find: (filter: Doc) => ({
        toArray: () => Promise.resolve(docs.filter((doc) => matches(doc, filter))),
      }),
      countDocuments: (filter: Doc) =>
        Promise.resolve(docs.filter((doc) => matches(doc, filter)).length),
      updateOne: (filter: Doc, update: Record<string, Doc>) => {
        writes.push({ collection: name, update });
        let doc = docs.find((d) => matches(d, filter));
        if (!doc) docs.push((doc = { ...filter }));
        apply(doc, update);
        return Promise.resolve();
      },
    };
  };
  const discord = { checkAssignableRoles: jest.fn() };
  const service = new GuildAutoRolesService({ collection } as unknown as Db, discord as never);
  return { service, discord, writes, settings, clans };
};

const save = (service: GuildAutoRolesService, body: AutoRolesInput) =>
  service.save({ guildId: GUILD, applicationId: null, body });

describe('GuildAutoRolesService', () => {
  it("reads the bot's settings with its defaults", async () => {
    const { service } = setup({
      settings: {
        townHallRoles: { '17': ROLE(1) },
        trophyRoles: { '5200_5249': { key: '5200_5249', min: 5200, max: 5249, roleId: ROLE(2) } },
        eosPushClanRoles: [ROLE(3)],
        delayExclusionList: { guestRole: true },
      },
      clans: [
        {
          guild: GUILD,
          tag: TAG,
          name: 'Pugs',
          roles: { admin: ROLE(4) },
          warRole: ROLE(5),
          secureRole: true,
        },
      ],
    });

    expect(await service.get(GUILD)).toMatchObject({
      townHall: { '17': ROLE(1) },
      trophies: { '5200_5249': ROLE(2) },
      eosPushRole: ROLE(3),
      delayExclusions: [DelayExclusion.GUEST_ROLE],
      autoUpdate: true,
      allowNotLinked: true,
      verifiedOnlyClanRoles: true,
      removalDelay: 0,
      clans: [{ tag: TAG, elder: ROLE(4), leader: null, warRole: ROLE(5) }],
    });
  });

  it('writes whole maps and roles under the keys the bot reads', async () => {
    const { service, discord, settings } = setup({
      settings: { leagueRoles: { titan: ROLE(9) }, guestRole: ROLE(9) },
    });

    await save(service, {
      townHall: { '16': ROLE(1), '17': ROLE(2) },
      trophies: { '6000_8000': ROLE(3) },
      leagues: {},
      verifiedRole: ROLE(4),
      guestRole: null,
      familyLeadersRoles: [ROLE(5), ROLE(5)],
      eosPushRole: ROLE(6),
      eosPushClans: [TAG],
      autoUpdate: false,
      removalDelay: 7 * 24 * 60 * 60 * 1000,
      delayExclusions: [DelayExclusion.TOWN_HALL_ROLES],
    });

    expect(settings[0]).toEqual({
      guildId: GUILD,
      townHallRoles: { '16': ROLE(1), '17': ROLE(2) },
      trophyRoles: { '6000_8000': { key: '6000_8000', min: 6000, max: 8000, roleId: ROLE(3) } },
      accountVerifiedRole: ROLE(4),
      familyLeadersRole: [ROLE(5)],
      eosPushClanRoles: [ROLE(6)],
      eosPushClans: [TAG],
      useAutoRole: false,
      roleRemovalDelays: 604800000,
      delayExclusionList: { townHallRoles: true },
    });
    expect(discord.checkAssignableRoles).toHaveBeenCalledWith(GUILD, null, [
      ROLE(1),
      ROLE(2),
      ROLE(3),
      ROLE(4),
      ROLE(5),
      ROLE(6),
    ]);
  });

  it('rejects keys the bot has no roles for, unknown clans, and servers with no clans', async () => {
    const { service } = setup();
    await expect(save(service, { townHall: { '19': ROLE(1) } })).rejects.toThrow(
      BadRequestException,
    );
    await expect(save(service, { leagues: { bronze: ROLE(1) } })).rejects.toThrow(
      BadRequestException,
    );
    await expect(save(service, { eosPushClans: ['#NOTHERE'] })).rejects.toThrow(
      BadRequestException,
    );

    const empty = setup({ clans: [] });
    await expect(save(empty.service, { guestRole: ROLE(1) })).rejects.toThrow(
      'Add a clan to this server first.',
    );
    await expect(save(empty.service, { autoUpdate: true })).resolves.toBeDefined();
  });

  it('saves nicknames with the bot rules for placeholders', async () => {
    const { service, settings } = setup();
    expect(await service.get(GUILD)).toMatchObject({
      familyNicknameFormat: '',
      autoNickname: false,
      nicknameAccount: 'default-or-best-account',
      nicknameRoleLabels: { leader: '', coLeader: '', elder: '', member: '' },
    });

    await expect(save(service, { familyNicknameFormat: '{TH} {CLAN}' })).rejects.toThrow(
      'The family nickname needs',
    );
    await expect(save(service, { nonFamilyNicknameFormat: '{NAME} | {clan}' })).rejects.toThrow(
      "can't use clan placeholders",
    );

    await save(service, {
      familyNicknameFormat: '{name} | {ROLE}',
      nonFamilyNicknameFormat: '',
      autoNickname: true,
      nicknameRoleLabels: { leader: 'L', coLeader: '', elder: 'E', member: '' },
    });
    expect(settings[0]).toMatchObject({
      familyNicknameFormat: '{name} | {ROLE}',
      nonFamilyNicknameFormat: '',
      autoNickname: true,
      roleReplacementLabels: { leader: 'L', coLeader: '', admin: 'E', member: '' },
    });
  });

  it("saves a clan's roles and keeps in-war roles to one clan", async () => {
    const other = {
      _id: new ObjectId(),
      guild: GUILD,
      tag: '#OTHER',
      name: 'Other',
      warRole: ROLE(9),
    };
    const { service, clans } = setup({
      clans: [{ _id: new ObjectId(), guild: GUILD, tag: TAG, name: 'Pugs' }, other],
    });
    const body = { leader: ROLE(1), coLeader: null, elder: ROLE(2), member: null, everyone: null };

    await expect(
      service.saveClan({
        guildId: GUILD,
        applicationId: null,
        clanTag: TAG,
        body: { ...body, warRole: ROLE(9) },
      }),
    ).rejects.toThrow('That in-war role is already used by Other.');
    await expect(
      service.saveClan({
        guildId: GUILD,
        applicationId: null,
        clanTag: '#NOPE',
        body: { ...body, warRole: null },
      }),
    ).rejects.toThrow(NotFoundException);

    await service.saveClan({
      guildId: GUILD,
      applicationId: null,
      clanTag: TAG,
      body: { ...body, warRole: ROLE(3) },
    });
    expect(clans[0]).toMatchObject({
      roles: { leader: ROLE(1), admin: ROLE(2) },
      warRole: ROLE(3),
    });

    await service.saveClan({
      guildId: GUILD,
      applicationId: null,
      clanTag: TAG,
      body: {
        leader: null,
        coLeader: null,
        elder: null,
        member: null,
        everyone: null,
        warRole: null,
      },
    });
    expect(clans[0].roles).toBeUndefined();
    expect(clans[0].warRole).toBeUndefined();
  });
});

describe('GuildDiscordService.checkAssignableRoles', () => {
  const roles = [
    { id: GUILD, name: '@everyone', position: 0, managed: false },
    { id: ROLE(1), name: 'Member', position: 1, managed: false },
    { id: ROLE(2), name: 'ClashPerk', position: 5, managed: true },
    { id: ROLE(3), name: 'Admin', position: 9, managed: false },
  ];
  const service = new GuildDiscordService(
    { collection: () => ({ findOne: () => null }) } as unknown as Db,
    {
      getGuild: () => Promise.resolve({ roles }),
      getBotMember: () => Promise.resolve({ roles: [ROLE(2)] }),
    } as never,
    {} as never,
  );
  const check = (roleId: string) => service.checkAssignableRoles(GUILD, null, [roleId]);

  it('allows roles below the bot and rejects the rest', async () => {
    await expect(check(ROLE(1))).resolves.toBeUndefined();
    await expect(check(GUILD)).rejects.toThrow("@everyone can't be given out");
    await expect(check(ROLE(2))).rejects.toThrow('managed by a bot');
    await expect(check(ROLE(3))).rejects.toThrow("ClashPerk can't give out Admin");
    await expect(check('333333333333333333')).rejects.toThrow('Pick roles in this server.');
  });
});
