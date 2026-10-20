import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Collections } from '../db';
import { RosterCategory, RosterSortBy } from './dto';
import { RostersService } from './rosters.service';

jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

const GUILD = '111111111111111111';
const USER = '222222222222222222';
const ROLE = '333333333333333333';

type Doc = Record<string, unknown>;
type Store = Record<string, Doc[]>;

const same = (a: unknown, b: unknown) =>
  a instanceof ObjectId || b instanceof ObjectId
    ? String(a) === String(b)
    : JSON.stringify(a) === JSON.stringify(b);

const get = (doc: Doc, path: string): unknown[] => {
  const [head, ...rest] = path.split('.');
  const value = doc[head];
  if (!rest.length) return Array.isArray(value) ? [...value, value] : [value];
  const items = Array.isArray(value) ? value : [value];
  return items.flatMap((item) => (item ? get(item as Doc, rest.join('.')) : [undefined]));
};

const matches = (doc: Doc, filter: Doc): boolean =>
  Object.entries(filter).every(([key, cond]) => {
    const values = get(doc, key);
    if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && !Array.isArray(cond)) {
      const op = cond as Doc;
      if ('$ne' in op) return !values.some((v) => same(v ?? null, op.$ne));
      if ('$in' in op) return values.some((v) => (op.$in as unknown[]).some((x) => same(v, x)));
      if ('$nin' in op) return !values.some((v) => (op.$nin as unknown[]).some((x) => same(v, x)));
    }
    return values.some((v) => same(v ?? null, cond));
  });

const setup = (store: Store, opts: { players?: Doc[]; clans?: Doc[] } = {}) => {
  const collection = (name: string) => {
    store[name] ??= [];
    const docs = () => store[name];
    const sorted = (filter: Doc, options?: { sort?: Record<string, number> }) => {
      const found = docs().filter((doc) => matches(doc, filter));
      const [key, dir] = Object.entries(options?.sort ?? {})[0] ?? [];
      if (key) found.sort((a, b) => ((a[key] as number) - (b[key] as number)) * (dir ?? 1));
      return found;
    };
    return {
      findOne: (filter: Doc, options?: { sort?: Record<string, number> }) =>
        Promise.resolve(sorted(filter, options)[0] ?? null),
      find: (filter: Doc, options?: { sort?: Record<string, number> }) => ({
        toArray: () => Promise.resolve(sorted(filter, options)),
      }),
      insertOne: (doc: Doc) => Promise.resolve(docs().push({ ...doc })),
      insertMany: (items: Doc[]) => Promise.resolve(docs().push(...items)),
      deleteOne: (filter: Doc) => {
        store[name] = docs().filter((doc) => !matches(doc, filter));
        return Promise.resolve();
      },
      updateOne: (filter: Doc, update: Record<string, Doc>, options?: { upsert?: boolean }) => {
        let doc = docs().find((d) => matches(d, filter));
        if (!doc && options?.upsert) docs().push((doc = { ...filter }));
        if (!doc) return Promise.resolve();
        for (const [key, value] of Object.entries(update.$set ?? {})) {
          if (key === 'members.$.categoryId') {
            const member = (doc.members as Doc[]).find((m) => m.tag === filter['members.tag']);
            if (member) member.categoryId = value;
          } else doc[key] = value;
        }
        for (const [key, value] of Object.entries(update.$push ?? {})) {
          doc[key] = [...(doc[key] as Doc[]), ...((value as Doc).$each as Doc[])];
        }
        for (const [key, value] of Object.entries(update.$pull ?? {})) {
          const tags = ((value as Doc).tag as Doc).$in as string[];
          doc[key] = (doc[key] as Doc[]).filter((m) => !tags.includes(m.tag as string));
        }
        return Promise.resolve();
      },
    };
  };
  const players: Doc[] = (opts.players ?? []).map((p) => ({
    heroes: [],
    trophies: 5000,
    role: 'member',
    ...p,
  }));
  const clash = {
    getPlayers: (tags: string[]) =>
      Promise.resolve(players.filter((p) => tags.includes(p.tag as string))),
    getClan: (tag: string) =>
      Promise.resolve((opts.clans ?? []).find((c) => c.tag === tag) ?? null),
  };
  return new RostersService(clash as never, { collection } as unknown as Db);
};

const roster = (overrides: Doc = {}): Doc => ({
  _id: new ObjectId(),
  guildId: GUILD,
  name: 'CWL',
  clan: null,
  category: 'CWL',
  closed: false,
  members: [],
  ...overrides,
});

const player = (tag: string, townHallLevel = 16, extra: Doc = {}) => ({
  tag,
  name: `P${tag}`,
  townHallLevel,
  ...extra,
});

describe('RostersService', () => {
  it('checks players with the bot rules, counting earlier ones toward the limits', async () => {
    const target = roster({
      minTownHall: 14,
      maxMembers: 5,
      maxAccountsPerUser: 1,
      members: [{ tag: '#QN' }],
    });
    const strict = roster({ name: 'Friday', allowMultiSignup: false, members: [{ tag: '#BUSY' }] });
    const store: Store = {
      [Collections.ROSTERS]: [target, strict],
      [Collections.PLAYER_LINKS]: [
        { tag: '#A', userId: USER, username: 'u', displayName: 'U' },
        { tag: '#B', userId: USER, username: 'u', displayName: 'U' },
        { tag: '#LW', userId: '9', username: 'x', displayName: 'X' },
        { tag: '#BUSY', userId: '8', username: 'y', displayName: 'Y' },
        { tag: '#QN', userId: '7', username: 'z', displayName: 'Z' },
      ],
    };
    const service = setup(store, {
      players: [
        player('#A'),
        player('#B'),
        player('#LW', 12),
        player('#BUSY'),
        player('#QN'),
        player('#NLINK'),
      ],
    });

    const result = await service.checkMembers({
      guildId: GUILD,
      rosterId: String(target._id),
      playerTags: ['a', '#B', '#LW', '#BUSY', '#QN', '#NLINK', '#GONE', '#A'],
    });

    expect(result.map((r) => [r.tag, r.canJoin, r.reason])).toEqual([
      ['#A', true, null],
      ['#B', false, 'This member already has 1 accounts on the roster.'],
      ['#LW', false, 'Needs Town Hall 14 or higher.'],
      ['#BUSY', false, 'Already on Friday, which allows one roster per player.'],
      ['#QN', false, 'Already on this roster.'],
      ['#NLINK', false, 'This player isn’t linked to a Discord member.'],
      ['#G0NE', false, 'No player has this tag.'],
    ]);
  });

  it('adds the players who pass in the bot member format, with the group', async () => {
    const target = roster();
    const groupId = new ObjectId();
    const store: Store = {
      [Collections.ROSTERS]: [target],
      [Collections.ROSTER_GROUPS]: [{ _id: groupId, guildId: GUILD, name: 'confirmed' }],
      [Collections.PLAYER_LINKS]: [
        { tag: '#A', userId: USER, username: 'suvajit', displayName: 'Suvajit' },
      ],
    };
    const service = setup(store, {
      players: [
        player('#A', 17, {
          warPreference: 'in',
          leagueTier: { id: 105000036 },
          heroes: [
            { name: 'Barbarian King', level: 95, village: 'home' },
            { name: 'Battle Machine', level: 30, village: 'builderBase' },
          ],
          clan: { tag: '#C', name: 'Clan' },
        }),
      ],
    });

    const { result } = await service.addMembers({
      guildId: GUILD,
      rosterId: String(target._id),
      playerTags: ['#A', '#B'],
      groupId: String(groupId),
    });

    expect(result.map((r) => r.canJoin)).toEqual([true, false]);
    expect(target.members).toEqual([
      expect.objectContaining({
        tag: '#A',
        userId: USER,
        username: 'suvajit',
        displayName: 'Suvajit',
        warPreference: 'in',
        leagueId: 105000036,
        heroes: { 'Barbarian King': 95 },
        clan: { tag: '#C', name: 'Clan' },
        categoryId: groupId,
      }),
    ]);
  });

  it('creates a roster from the server defaults and seeds the default groups', async () => {
    const store: Store = {
      [Collections.SETTINGS]: [
        { guildId: GUILD, rosterDefaultSettings: { maxMembers: 30, allowUnlinked: true } },
      ],
    };
    const service = setup(store);

    const created = await service.createRoster(GUILD, {
      name: 'Push',
      category: RosterCategory.TROPHY,
    });

    expect(created).toMatchObject({
      name: 'Push',
      clan: null,
      category: 'TROPHY',
      closed: false,
      maxMembers: 30,
      allowUnlinked: true,
      allowMultiSignup: true,
      allowCategorySelection: true,
      requireCategorySelection: false,
      sortBy: RosterSortBy.TROPHIES,
      layout: '#/TH_ICON/TROPHIES/NAME',
      roleId: null,
      members: [],
    });
    expect(store[Collections.ROSTER_GROUPS].map((g) => [g.displayName, g.order])).toEqual([
      ['Confirmed', 10],
      ['Substitute', 20],
    ]);
    expect(store[Collections.SETTINGS][0].rosterDefaultSettings).toMatchObject({ maxMembers: 30 });
  });

  it("rejects the bot's invalid settings", async () => {
    const store: Store = { [Collections.ROSTERS]: [roster({ roleId: ROLE })] };
    const service = setup(store);
    const soon = new Date(Date.now() + 60_000).toISOString();

    await expect(service.createRoster(GUILD, { name: 'X', roleId: ROLE })).rejects.toThrow(
      ConflictException,
    );
    await expect(service.createRoster(GUILD, { name: 'X', startTime: soon })).rejects.toThrow(
      'at least 5 minutes',
    );
    await expect(
      service.createRoster(GUILD, {
        name: 'X',
        allowCategorySelection: false,
        requireCategorySelection: true,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(service.createRoster(GUILD, { name: 'X', layout: '#/NAME' })).rejects.toThrow(
      'Pick 3 to 5 columns',
    );
    await expect(service.createRoster(GUILD, { name: 'X', clanTag: '#NOPE' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('blocks single sign-up while members are on another open roster', async () => {
    const target = roster({ allowMultiSignup: true, members: [{ tag: '#A' }] });
    const other = roster({ name: 'Other', members: [{ tag: '#A' }] });
    const service = setup({ [Collections.ROSTERS]: [target, other] });

    await expect(
      service.updateRoster(GUILD, String(target._id), { allowMultiSignup: false }),
    ).rejects.toThrow('Some players are also on Other');

    await service.updateRoster(GUILD, String(target._id), { closed: true, name: 'Renamed' });
    expect(target).toMatchObject({ closed: true, name: 'Renamed' });
  });

  it('moves players only when the target roster takes them', async () => {
    const source = roster({
      members: [
        { tag: '#A', categoryId: null },
        { tag: '#LW', categoryId: null },
      ],
    });
    const target = roster({ name: 'Target', minTownHall: 14 });
    const store: Store = {
      [Collections.ROSTERS]: [source, target],
      [Collections.PLAYER_LINKS]: [
        { tag: '#A', userId: USER, username: 'u', displayName: 'U' },
        { tag: '#LW', userId: USER, username: 'u', displayName: 'U' },
      ],
    };
    const service = setup(store, { players: [player('#A'), player('#LW', 12)] });

    const { result } = await service.transferRosterMembers({
      guildId: GUILD,
      rosterId: String(source._id),
      playerTags: ['#A', '#LW'],
      newRosterId: String(target._id),
    });

    expect(result.map((r) => r.success)).toEqual([true, false]);
    expect((source.members as Doc[]).map((m) => m.tag)).toEqual(['#LW']);
    expect((target.members as Doc[]).map((m) => m.tag)).toEqual(['#A']);
  });

  it('keeps groups unique and scoped to the server', async () => {
    const store: Store = {
      [Collections.ROSTER_GROUPS]: [
        {
          _id: new ObjectId(),
          guildId: GUILD,
          name: 'confirmed',
          displayName: 'Confirmed',
          order: 10,
        },
      ],
    };
    const service = setup(store);

    await expect(service.createGroup(GUILD, { name: ' confirmed ' })).rejects.toThrow(
      ConflictException,
    );
    await service.createGroup(GUILD, { name: 'Bench Warmers', roleId: ROLE });
    expect(store[Collections.ROSTER_GROUPS][1]).toMatchObject({
      name: 'bench_warmers',
      displayName: 'Bench Warmers',
      order: 20,
      selectable: false,
      roleId: ROLE,
    });
    await expect(
      service.deleteGroup('999', String(store[Collections.ROSTER_GROUPS][1]._id)),
    ).rejects.toThrow(NotFoundException);
  });
});
