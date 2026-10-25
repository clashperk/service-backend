import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Collections } from '../db';
import { FlagInput, FlagType } from './dto';
import { GuildFlagsService } from './guild-flags.service';

vi.mock('@app/clash-client', () => ({ ClashClientService: class {} }));
vi.mock('@app/discord-rest', () => ({ DiscordRestService: class {} }));

const GUILD = '111111111111111111';
const USER = '222222222222222222';
const DAY = 24 * 60 * 60 * 1000;

type Doc = Record<string, unknown>;

const isActive = (doc: Doc) => doc.expiresAt === null || (doc.expiresAt as Date) > new Date();

const setup = (opts: { flags?: Doc[]; patron?: boolean } = {}) => {
  const flags: Doc[] = opts.flags ?? [];
  const own = (doc: Doc, filter: Doc) =>
    doc.guild === filter.guild &&
    (!filter.flagType || doc.flagType === filter.flagType) &&
    (!filter._id || (filter._id as ObjectId).equals(doc._id as ObjectId)) &&
    isActive(doc);
  const collections: Record<string, unknown> = {
    [Collections.FLAGS]: {
      find: (filter: Doc) => ({
        sort: () => ({ toArray: () => Promise.resolve(flags.filter((f) => own(f, filter))) }),
      }),
      countDocuments: (filter: Doc) => Promise.resolve(flags.filter((f) => own(f, filter)).length),
      insertMany: (docs: Doc[]) => Promise.resolve(flags.push(...docs)),
      deleteOne: (filter: Doc) => {
        const index = flags.findIndex((f) => own(f, filter));
        if (index >= 0) flags.splice(index, 1);
        return Promise.resolve({ deletedCount: index >= 0 ? 1 : 0 });
      },
    },
    [Collections.PATRONS]: { findOne: () => Promise.resolve(opts.patron ? {} : null) },
  };
  const clash = {
    getPlayers: (tags: string[]) =>
      Promise.resolve(
        tags.filter((tag) => tag !== '#G0NE').map((tag) => ({ tag, name: `P${tag}` })),
      ),
  };
  const discord = {
    getUser: () =>
      Promise.resolve({
        id: USER,
        username: 'suvajit',
        global_name: 'Suvajit',
        discriminator: '0',
      }),
  };
  const service = new GuildFlagsService(
    { collection: (name: string) => collections[name] } as unknown as Db,
    clash as never,
    discord as never,
  );
  return { service, flags };
};

const body = (overrides: Partial<FlagInput> = {}): FlagInput => ({
  flagType: FlagType.STRIKE,
  playerTags: ['#2pp', '2PP'],
  reason: 'Left *mid* war',
  ...overrides,
});

describe('GuildFlagsService', () => {
  it("adds one flag per player in the bot's format", async () => {
    const { service, flags } = setup();

    const created = await service.create({
      guildId: GUILD,
      userId: USER,
      body: body({ expiresInDays: 30, flagImpact: 3 }),
    });

    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      guild: GUILD,
      user: USER,
      username: 'suvajit',
      displayName: 'Suvajit',
      discriminator: '0',
      flagType: 'strike',
      tag: '#2PP',
      name: 'P#2PP',
      flagImpact: 3,
      reason: 'Left \\*mid\\* war',
    });
    expect((flags[0].expiresAt as Date).getTime() - (flags[0].createdAt as Date).getTime()).toBe(
      30 * DAY,
    );
    expect(created[0]).toMatchObject({ reason: 'Left *mid* war', createdBy: { id: USER } });
  });

  it('keeps flags forever without an expiry and rejects unknown players', async () => {
    const { service, flags } = setup();
    await service.create({ guildId: GUILD, userId: USER, body: body({ flagType: FlagType.BAN }) });
    expect(flags[0]).toMatchObject({ expiresAt: null, flagImpact: 1 });

    await expect(
      service.create({ guildId: GUILD, userId: USER, body: body({ playerTags: ['#GONE'] }) }),
    ).rejects.toThrow(NotFoundException);
  });

  it('stops at 1000 active flags unless the server is a supporter', async () => {
    const full = Array.from({ length: 1000 }, () => ({
      _id: new ObjectId(),
      guild: GUILD,
      expiresAt: null,
      reason: '',
    }));
    const expired = { guild: GUILD, expiresAt: new Date(Date.now() - DAY) };

    const { service } = setup({ flags: [...full] });
    await expect(service.create({ guildId: GUILD, userId: USER, body: body() })).rejects.toThrow(
      ForbiddenException,
    );

    const roomy = setup({ flags: [...full.slice(1), expired] });
    await expect(
      roomy.service.create({ guildId: GUILD, userId: USER, body: body() }),
    ).resolves.toHaveLength(1);

    const patron = setup({ flags: [...full], patron: true });
    await expect(
      patron.service.create({ guildId: GUILD, userId: USER, body: body() }),
    ).resolves.toHaveLength(1);
    expect((await patron.service.list(GUILD)).limit).toBeNull();
  });

  it("lists and deletes only this server's active flags", async () => {
    const mine = {
      _id: new ObjectId(),
      guild: GUILD,
      flagType: 'ban',
      expiresAt: null,
      reason: 'a\\_b',
    };
    const expired = {
      _id: new ObjectId(),
      guild: GUILD,
      flagType: 'ban',
      expiresAt: new Date(0),
      reason: '',
    };
    const other = { _id: new ObjectId(), guild: '9', flagType: 'ban', expiresAt: null, reason: '' };
    const { service, flags } = setup({ flags: [mine, expired, other] });

    const list = await service.list(GUILD, FlagType.BAN);
    expect(list).toMatchObject({ total: 1, limit: 1000 });
    expect(list.items.map((f) => f.reason)).toEqual(['a_b']);

    await expect(
      service.delete({ guildId: GUILD, flagId: other._id.toHexString() }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.delete({ guildId: GUILD, flagId: expired._id.toHexString() }),
    ).rejects.toThrow(NotFoundException);
    await service.delete({ guildId: GUILD, flagId: mine._id.toHexString() });
    expect(flags).toEqual([expired, other]);
  });
});
