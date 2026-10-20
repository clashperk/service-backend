import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Collections } from '../db';
import { GuildClansService } from './guild-clans.service';

jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));
jest.mock('@app/discord-rest', () => ({ DiscordRestService: class {} }));

const GUILD = '111111111111111142';
const OTHER_GUILD = '999999999999999999';
const USER = '222222222222222222';
const TAG = '#2PC9YQL0Q';

type Doc = Record<string, unknown>;
type Store = Record<string, Doc[]>;

const same = (a: unknown, b: unknown) =>
  a instanceof ObjectId ? a.equals(b as ObjectId) : JSON.stringify(a) === JSON.stringify(b);

const matches = (doc: Doc, filter: Doc) =>
  Object.entries(filter).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && !Array.isArray(cond)) {
      const op = cond as Doc;
      if ('$ne' in op) return !same(value, op.$ne);
      if ('$in' in op) {
        const list = op.$in as unknown[];
        return Array.isArray(value) ? value.some((v) => list.includes(v)) : list.includes(value);
      }
      if ('$regex' in op)
        return new RegExp(op.$regex as string, op.$options as string).test(
          typeof value === 'string' ? value : '',
        );
    }
    if (Array.isArray(value) && !Array.isArray(cond)) return value.includes(cond);
    return same(value ?? null, cond);
  });

const setup = (
  store: Store,
  opts: { clan?: Partial<{ description: string; memberList: Doc[] }>; members?: number } = {},
) => {
  const collection = (name: string) => {
    store[name] ??= [];
    const docs = () => store[name];
    const update = (doc: Doc, change: Record<string, Doc>) => {
      Object.assign(doc, change.$set ?? {});
      for (const key of Object.keys(change.$unset ?? {})) delete doc[key];
      for (const [key, value] of Object.entries(change.$pull ?? {})) {
        doc[key] = (doc[key] as unknown[]).filter((item) => item !== value);
      }
    };
    return {
      findOne: (filter: Doc, options?: { sort?: Record<string, number> }) => {
        const found = docs().filter((doc) => matches(doc, filter));
        const [key, dir] = Object.entries(options?.sort ?? {})[0] ?? [];
        if (key) found.sort((a, b) => ((a[key] as number) - (b[key] as number)) * (dir ?? 1));
        return Promise.resolve(found[0] ?? null);
      },
      find: (filter: Doc, options?: { sort?: Record<string, number> }) => ({
        next: () => {
          const [key, dir] = Object.entries(options?.sort ?? {})[0] ?? [];
          const found = docs().filter((doc) => matches(doc, filter));
          if (key) found.sort((a, b) => ((a[key] as number) - (b[key] as number)) * (dir ?? 1));
          return Promise.resolve(found[0] ?? null);
        },
      }),
      countDocuments: (filter: Doc) =>
        Promise.resolve(docs().filter((doc) => matches(doc, filter)).length),
      insertOne: (doc: Doc) => Promise.resolve(docs().push({ _id: new ObjectId(), ...doc })),
      updateOne: (filter: Doc, change: Record<string, Doc>, options?: { upsert?: boolean }) => {
        const doc = docs().find((d) => matches(d, filter));
        if (doc) update(doc, change);
        else if (options?.upsert) {
          docs().push({ _id: new ObjectId(), ...filter, ...change.$setOnInsert, ...change.$set });
        }
        return Promise.resolve({ matchedCount: doc ? 1 : 0 });
      },
      updateMany: (filter: Doc, change: Record<string, Doc>) => {
        for (const doc of docs().filter((d) => matches(d, filter))) update(doc, change);
        return Promise.resolve();
      },
      deleteOne: (filter: Doc) => {
        const index = docs().findIndex((doc) => matches(doc, filter));
        if (index >= 0) docs().splice(index, 1);
        return Promise.resolve({ deletedCount: index >= 0 ? 1 : 0 });
      },
      deleteMany: (filter: Doc) => {
        store[name] = docs().filter((doc) => !matches(doc, filter));
        return Promise.resolve();
      },
    };
  };
  const clash = {
    getClan: (tag: string) =>
      Promise.resolve(
        tag === TAG
          ? { tag, name: 'ButterflyPugs', description: '', memberList: [], ...opts.clan }
          : null,
      ),
  };
  const discord = {
    memberCount: () => Promise.resolve(opts.members ?? 500),
    listChannels: () =>
      Promise.resolve(
        ['1', '2', '3'].map((n) => ({ id: `44444444444444444${n}`, selectable: true })),
      ),
  };
  const guilds = { getGuildClans: jest.fn().mockResolvedValue({ categories: [] }) };
  return new GuildClansService(
    { collection } as unknown as Db,
    clash as never,
    discord as never,
    guilds as never,
  );
};

const add = (service: GuildClansService, body: { tag: string; categoryId?: string }) =>
  service.add({ guildId: GUILD, userId: USER, applicationId: null, body });

const filler = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ guild: GUILD, tag: `#FILL${i}`, verified: true }));

describe('GuildClansService', () => {
  it('adds a clan in the bot format, sharing its ID with other servers', async () => {
    const store: Store = {
      [Collections.CLAN_STORES]: [
        { guild: OTHER_GUILD, tag: TAG, uniqueId: 1500 },
        { guild: OTHER_GUILD, tag: '#OTHER', uniqueId: 2000 },
      ],
    };

    await add(setup(store), { tag: '2pc9yqloq' });

    expect(store[Collections.CLAN_STORES].find((c) => c.guild === GUILD)).toMatchObject({
      tag: TAG,
      name: 'ButterflyPugs',
      uniqueId: 1500,
      order: 1,
      paused: false,
      active: true,
      verified: true,
      patron: false,
    });
  });

  it('gives a new clan the next ID and rejects unknown tags and categories', async () => {
    const store: Store = { [Collections.CLAN_STORES]: [{ guild: OTHER_GUILD, uniqueId: 2000 }] };
    const service = setup(store);

    await expect(add(service, { tag: '#NOPE' })).rejects.toThrow(NotFoundException);
    await expect(
      add(service, { tag: TAG, categoryId: new ObjectId().toHexString() }),
    ).rejects.toThrow(NotFoundException);
    await add(service, { tag: TAG });

    expect(store[Collections.CLAN_STORES].find((c) => c.guild === GUILD)?.uniqueId).toBe(2001);
  });

  it('asks for verification past the limit for the server size', async () => {
    const store = (): Store => ({ [Collections.CLAN_STORES]: filler(5) });

    await expect(add(setup(store(), { members: 30 }), { tag: TAG })).rejects.toThrow(
      new ForbiddenException(
        "This clan needs verifying first. Put CP42 in its description in the game, or verify a Leader or Co-Leader account you've linked, then try again.",
      ),
    );
    await expect(add(setup(store(), { members: 500 }), { tag: TAG })).resolves.toBeDefined();
    await expect(
      add(setup(store(), { members: 30, clan: { description: 'Family cp42' } }), { tag: TAG }),
    ).resolves.toBeDefined();

    const linked = store();
    linked[Collections.PLAYER_LINKS] = [{ userId: USER, tag: '#LEAD', verified: true }];
    const memberList = [{ tag: '#LEAD', role: 'coLeader' }];
    await expect(
      add(setup(linked, { members: 30, clan: { memberList } }), { tag: TAG }),
    ).resolves.toBeDefined();
  });

  it('skips verification for supporters', async () => {
    const store: Store = {
      [Collections.CLAN_STORES]: filler(5),
      [Collections.PATRONS]: [{ 'active': true, 'guilds.id': GUILD }],
    };
    await expect(add(setup(store, { members: 30 }), { tag: TAG })).resolves.toBeDefined();
  });

  it('removes a clan with its logs, reminders and schedules', async () => {
    const clanId = new ObjectId();
    const store: Store = {
      [Collections.CLAN_STORES]: [{ _id: clanId, guild: GUILD, tag: TAG }],
      [Collections.CLAN_LOGS]: [{ clanId }, { clanId: new ObjectId() }],
      [Collections.CLAN_WAR_REMINDERS]: [
        { guild: GUILD, clans: [TAG] },
        { guild: GUILD, clans: [TAG, '#OTHER'] },
        { guild: OTHER_GUILD, clans: [TAG] },
      ],
      [Collections.CLAN_WAR_SCHEDULES]: [
        { guild: GUILD, tag: TAG },
        { guild: GUILD, tag: '#OTHER' },
      ],
    };
    const service = setup(store);

    await service.remove({ guildId: GUILD, clanTag: TAG });

    expect(store[Collections.CLAN_STORES]).toHaveLength(0);
    expect(store[Collections.CLAN_LOGS]).toHaveLength(1);
    expect(store[Collections.CLAN_WAR_REMINDERS]).toEqual([
      { guild: GUILD, clans: ['#OTHER'] },
      { guild: OTHER_GUILD, clans: [TAG] },
    ]);
    expect(store[Collections.CLAN_WAR_SCHEDULES]).toEqual([{ guild: GUILD, tag: '#OTHER' }]);
    await expect(service.remove({ guildId: GUILD, clanTag: TAG })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("keeps category names unique and only touches this server's categories", async () => {
    const categoryId = new ObjectId();
    const store: Store = {
      [Collections.CLAN_CATEGORIES]: [
        { _id: categoryId, guildId: GUILD, name: 'war_clans', displayName: 'War clans', order: 2 },
      ],
      [Collections.CLAN_STORES]: [{ guild: GUILD, tag: TAG, categoryId }],
    };
    const service = setup(store);

    await expect(service.createCategory(GUILD, ' War  Clans ')).rejects.toThrow(ConflictException);
    await service.createCategory(GUILD, 'Feeders');
    expect(store[Collections.CLAN_CATEGORIES][1]).toMatchObject({
      name: 'feeders',
      displayName: 'Feeders',
      order: 3,
    });

    await expect(service.deleteCategory(OTHER_GUILD, categoryId.toHexString())).rejects.toThrow(
      NotFoundException,
    );
    await service.deleteCategory(GUILD, categoryId.toHexString());
    expect(store[Collections.CLAN_STORES][0].categoryId).toBeNull();
  });

  it("saves an alias, short name and clan channels with the bot's rules", async () => {
    const mine: Doc = { _id: new ObjectId(), guild: GUILD, tag: TAG, name: 'Pugs', alias: 'old' };
    const other = {
      _id: new ObjectId(),
      guild: GUILD,
      tag: '#OTHER',
      name: 'Other',
      alias: 'War',
      channels: ['444444444444444443'],
    };
    const store: Store = { [Collections.CLAN_STORES]: [mine, other] };
    const service = setup(store);
    const save = (body: Doc) =>
      service.updateSettings({ guildId: GUILD, applicationId: null, clanTag: TAG, body });

    await expect(save({ alias: 'war' })).rejects.toThrow('Other already uses that alias.');
    await expect(save({ channels: ['444444444444444443'] })).rejects.toThrow(
      "already Other's clan channel",
    );
    await expect(save({ channels: ['999999999999999999'] })).rejects.toThrow(
      'Pick channels or threads in this server.',
    );

    await save({ alias: 'BP', nickname: 'Pugs', channels: ['444444444444444441'] });
    expect(mine).toMatchObject({ alias: 'BP', nickname: 'Pugs', channels: ['444444444444444441'] });

    await save({ alias: null, nickname: null, channels: [] });
    expect(mine).not.toHaveProperty('alias');
    expect(mine).not.toHaveProperty('nickname');
    expect(mine.channels).toEqual([]);
  });
});
