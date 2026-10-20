import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Collections } from '../db';
import { ChannelStatus, ClanEmbedField, ClanLogInput, ClanLogType } from './dto';
import { GuildLogsService } from './guild-logs.service';

jest.mock('@app/discord-oauth', () => ({ DiscordOauthService: class {} }));

const GUILD = '111111111111111111';
const CHANNEL = '222222222222222222';
const OTHER_CHANNEL = '333333333333333333';
const TAG = '#2JQV9QL2Q';
const clanId = new ObjectId();

type Doc = Record<string, unknown>;

const setup = (
  logs: Doc[] = [],
  opts: { clans?: Doc[]; clanLimit?: number; patron?: boolean } = {},
) => {
  const clans: Doc[] = opts.clans ?? [{ _id: clanId, guild: GUILD, tag: TAG }];
  const updates: Doc[] = [];
  const matches = (doc: Doc, filter: Doc) =>
    Object.entries(filter).every(([key, value]) => doc[key] === value);
  const collections: Record<string, unknown> = {
    [Collections.CLAN_STORES]: {
      findOne: (filter: Doc) =>
        Promise.resolve(
          clans.find((c) => c.guild === filter.guild && c.tag === filter.tag) ?? null,
        ),
      find: (filter: { _id?: { $in: ObjectId[] }; guild: string }) => ({
        toArray: () =>
          Promise.resolve(
            clans.filter(
              (c) =>
                c.guild === filter.guild &&
                (!filter._id || filter._id.$in.some((id) => id.equals(c._id as ObjectId))),
            ),
          ),
      }),
    },
    [Collections.SETTINGS]: {
      findOne: () =>
        Promise.resolve(opts.clanLimit === undefined ? null : { clanLimit: opts.clanLimit }),
    },
    [Collections.PATRONS]: {
      findOne: () => Promise.resolve(opts.patron ? { _id: new ObjectId() } : null),
    },
    [Collections.CLAN_LOGS]: {
      findOne: (filter: Doc) => Promise.resolve(logs.find((log) => matches(log, filter)) ?? null),
      find: (filter: {
        guildId: string;
        clanTag: { $in: string[] };
        logType: { $in: string[] };
      }) => ({
        toArray: () =>
          Promise.resolve(
            logs.filter(
              (log) =>
                log.guildId === filter.guildId &&
                filter.clanTag.$in.includes(log.clanTag as string) &&
                filter.logType.$in.includes(log.logType as string),
            ),
          ),
      }),
      findOneAndUpdate: (filter: Doc, update: Doc) => {
        updates.push(update);
        const set = update.$set as Doc;
        const doc = { _id: new ObjectId(), ...filter, ...set, updatedAt: new Date() };
        return Promise.resolve(doc);
      },
      distinct: (_key: string, filter: Doc) =>
        Promise.resolve(logs.filter((log) => matches(log, filter)).map((log) => log.clanId)),
      deleteOne: (filter: Doc) =>
        Promise.resolve({ deletedCount: logs.some((log) => matches(log, filter)) ? 1 : 0 }),
      deleteMany: (filter: Doc) =>
        Promise.resolve({ deletedCount: logs.filter((log) => matches(log, filter)).length }),
    },
  };
  const db = { collection: (name: string) => collections[name] } as unknown as Db;
  const discord = {
    checkChannel: jest.fn(),
    checkRole: jest.fn(),
    resolveWebhook: jest.fn().mockResolvedValue(null),
    channelNames: jest.fn().mockResolvedValue(new Map([[CHANNEL, 'war-feed']])),
    channelInfo: jest.fn().mockResolvedValue(
      new Map([
        [CHANNEL, { name: 'war-feed', status: ChannelStatus.OK, parentName: null }],
        [OTHER_CHANNEL, { name: null, status: ChannelStatus.DELETED, parentName: null }],
      ]),
    ),
  };
  return { service: new GuildLogsService(db, discord as never), updates, discord };
};

const body = (overrides: Partial<ClanLogInput> = {}): ClanLogInput => ({
  channelId: CHANNEL,
  isEnabled: true,
  roleId: null,
  color: null,
  ...overrides,
});

const save = (service: GuildLogsService, input: ClanLogInput) =>
  service.save({
    guildId: GUILD,
    applicationId: null,
    clanTag: TAG,
    logType: ClanLogType.WAR_ATTACK_LOG,
    body: input,
  });

describe('GuildLogsService', () => {
  it('writes a new log in the bot format', async () => {
    const { service, updates, discord } = setup();

    const result = await save(service, body({ roleId: '444444444444444444', color: 0x378add }));

    const [update] = updates;
    expect(update.$set).toMatchObject({
      clanId,
      isEnabled: true,
      channelId: CHANNEL,
      deepLink: 'OPEN_IN_GAME',
      webhook: null,
      messageId: null,
      roleId: '444444444444444444',
      color: 0x378add,
    });
    expect(update.$min).toHaveProperty('lastPostedAt');
    expect(discord.checkChannel).toHaveBeenCalled();
    expect(discord.checkRole).toHaveBeenCalled();
    expect(result).toMatchObject({ channelName: 'war-feed', roleId: '444444444444444444' });
  });

  it('keeps the webhook and message in the same channel, and drops them when it moves', async () => {
    const existing = {
      guildId: GUILD,
      clanTag: TAG,
      logType: ClanLogType.WAR_ATTACK_LOG,
      channelId: CHANNEL,
      webhook: { id: '555555555555555555', token: 't' },
      messageId: '666666666666666666',
      roleId: '444444444444444444',
    };
    const { service, updates, discord } = setup([existing]);

    await save(service, body());
    expect(updates[0].$set).toMatchObject({
      webhook: existing.webhook,
      messageId: existing.messageId,
    });
    expect(updates[0].$unset).toEqual({ roleId: true });
    expect(discord.checkChannel).not.toHaveBeenCalled();

    await save(service, body({ channelId: OTHER_CHANNEL }));
    expect(updates[1].$set).toMatchObject({ webhook: null, messageId: null });
    expect(discord.checkChannel).toHaveBeenCalledWith(GUILD, null, OTHER_CHANNEL);
  });

  it("refuses clans the server hasn't added and logs that aren't set up", async () => {
    const { service } = setup();

    await expect(
      service.list({ guildId: GUILD, applicationId: null, clanTag: '#OTHER' }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.delete({ guildId: GUILD, clanTag: TAG, logType: ClanLogType.WAR_ATTACK_LOG }),
    ).rejects.toThrow(NotFoundException);
  });

  it("lists every clan's logs in the server, skipping removed clans and the clan embed", async () => {
    const log = (clanTag: string, logType: string, channelId = CHANNEL) => ({
      _id: new ObjectId(),
      guildId: GUILD,
      clanTag,
      logType,
      channelId,
      isEnabled: true,
      updatedAt: new Date(),
    });
    const { service, discord } = setup(
      [
        log(TAG, ClanLogType.WAR_ATTACK_LOG),
        log('#OTHER', ClanLogType.WAR_ATTACK_LOG, OTHER_CHANNEL),
        log('#GONE', ClanLogType.WAR_ATTACK_LOG),
        log(TAG, 'clan_embed_log'),
      ],
      {
        clans: [
          { _id: clanId, guild: GUILD, tag: TAG },
          { _id: new ObjectId(), guild: GUILD, tag: '#OTHER' },
        ],
      },
    );
    const logs = await service.listAll({ guildId: GUILD, applicationId: null });
    expect(logs.map((l) => [l.clanTag, l.channelName, l.channelStatus])).toEqual([
      [TAG, 'war-feed', ChannelStatus.OK],
      ['#OTHER', null, ChannelStatus.DELETED],
    ]);
    expect(discord.channelInfo).toHaveBeenCalledWith(GUILD, null, [CHANNEL, OTHER_CHANNEL]);
  });

  describe('clan limit', () => {
    const clan = (n: number) => ({ _id: new ObjectId(), guild: GUILD, tag: `#CLAN${n}` });
    const logFor = (c: Doc, logType = ClanLogType.DAILY_DONATION_LOG) => ({
      guildId: GUILD,
      clanTag: c.tag,
      clanId: c._id,
      logType,
    });

    it('allows logs for 2 clans for free and refuses a third with the Patreon link', async () => {
      const [a, b] = [clan(1), clan(2)];
      const { service } = setup([logFor(a), logFor(b)], {
        clans: [a, b, { _id: clanId, guild: GUILD, tag: TAG }],
      });
      await expect(save(service, body())).rejects.toThrow(
        new ForbiddenException(
          'Free servers can have logs for 2 clans. Support ClashPerk on Patreon (https://www.patreon.com/clashperk) for more, or use /redeem in Discord if you already do.',
        ),
      );
    });

    it('still adds logs to a clan that already has one, even when full', async () => {
      const other = clan(1);
      const { service } = setup([logFor(other), logFor({ _id: clanId, tag: TAG })], {
        clans: [other, { _id: clanId, guild: GUILD, tag: TAG }],
      });
      await expect(save(service, body())).resolves.toMatchObject({ channelId: CHANNEL });
    });

    it("uses the server's Patreon limit, and ignores logs of removed clans", async () => {
      const [a, b, gone] = [clan(1), clan(2), clan(3)];
      const { service } = setup([logFor(a), logFor(b), logFor(gone)], {
        clans: [a, b, { _id: clanId, guild: GUILD, tag: TAG }],
        clanLimit: 3,
        patron: true,
      });
      await expect(service.limit(GUILD)).resolves.toEqual({
        limit: 3,
        clanTags: ['#CLAN1', '#CLAN2'],
        patron: true,
      });
      await expect(save(service, body())).resolves.toMatchObject({ channelId: CHANNEL });
    });

    it('tells patrons at their limit to contact us', async () => {
      const [a, b] = [clan(1), clan(2)];
      const { service } = setup([logFor(a), logFor(b)], {
        clans: [a, b, { _id: clanId, guild: GUILD, tag: TAG }],
        patron: true,
      });
      await expect(save(service, body())).rejects.toThrow(/Contact us on Discord/);
    });
  });

  describe('clan embed', () => {
    const embed = { guildId: GUILD, applicationId: null, clanTag: TAG };

    it("saves the bot's metadata, with 'auto' for in-game text and '*' for every field", async () => {
      const { service, updates } = setup();
      const result = await service.saveEmbed({
        ...embed,
        body: {
          channelId: CHANNEL,
          color: 0xff0000,
          description: null,
          requirements: 'TH 14+, war active',
          bannerImage: null,
          fields: Object.values(ClanEmbedField),
        },
      });
      const set = updates[0].$set as Doc;
      expect(set).toMatchObject({
        clanId,
        isEnabled: true,
        channelId: CHANNEL,
        color: 0xff0000,
        messageId: null,
        metadata: {
          description: 'auto',
          accepts: 'TH 14+, war active',
          bannerImage: null,
          fields: ['*'],
        },
      });
      // Due right away, so the bot posts on its next refresh.
      expect((set.lastPostedAt as Date).getTime()).toBeLessThan(Date.now() - 29 * 60 * 1000);
      expect(result).toMatchObject({
        channelName: 'war-feed',
        description: null,
        requirements: 'TH 14+, war active',
        fields: Object.values(ClanEmbedField),
      });
    });

    it('keeps the posted message and rules text in the same channel, and orders fields', async () => {
      const { service, updates } = setup([
        {
          guildId: GUILD,
          clanTag: TAG,
          clanId,
          logType: 'clan_embed_log',
          channelId: CHANNEL,
          messageId: '444444444444444444',
          webhook: { id: '1', token: 't' },
          metadata: { rulesText: 'Be nice' },
        },
      ]);
      await service.saveEmbed({
        ...embed,
        body: {
          channelId: CHANNEL,
          fields: [ClanEmbedField.TOWN_HALLS, ClanEmbedField.CLAN_LEADER],
        },
      });
      expect(updates[0].$set).toMatchObject({
        messageId: '444444444444444444',
        webhook: { id: '1', token: 't' },
        metadata: { fields: ['clanLeader', 'townHalls'], rulesText: 'Be nice' },
      });
    });

    it('reads an old embed with every field and removes it', async () => {
      const { service } = setup([
        {
          guildId: GUILD,
          clanTag: TAG,
          logType: 'clan_embed_log',
          channelId: CHANNEL,
          metadata: { description: 'auto', accepts: 'AUTO', fields: ['*'] },
        },
      ]);
      const { embed: read } = await service.getEmbed(embed);
      expect(read).toMatchObject({
        description: null,
        requirements: null,
        fields: Object.values(ClanEmbedField),
      });
      await expect(service.deleteEmbed(embed)).resolves.toBeUndefined();
      await expect(setup().service.deleteEmbed(embed)).rejects.toThrow(NotFoundException);
    });

    it('applies the clan log limit to a new embed', async () => {
      const other = new ObjectId();
      const { service } = setup([{ guildId: GUILD, clanId: other, logType: 'war_attack_log' }], {
        clans: [
          { _id: clanId, guild: GUILD, tag: TAG },
          { _id: other, guild: GUILD, tag: '#OTHER' },
        ],
        clanLimit: 1,
      });
      await expect(
        service.saveEmbed({ ...embed, body: { channelId: CHANNEL, fields: [] } }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
