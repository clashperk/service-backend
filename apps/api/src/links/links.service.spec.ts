import { ForbiddenException } from '@nestjs/common';
import { Db } from 'mongodb';
import { LinksService } from './links.service';

// The service's clients are faked below; these modules pull in JSON the test setup can't load.
jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));
jest.mock('@app/clash-client/discord-link.service', () => ({ DiscordLinkService: class {} }));
jest.mock('@app/discord-oauth', () => ({ DiscordOauthService: class {} }));

type Link = { tag: string; userId: string; order?: number; verified?: boolean };

type Update = {
  filter: unknown;
  update: { $set: Record<string, unknown>; $setOnInsert?: Record<string, unknown> };
};

type Member = { tag: string; role: string };

const createService = (links: Link[], clanMembers: Member[] = []) => {
  const updates: Update[] = [];
  const collection = {
    findOne: (filter: { tag?: string; userId?: string }) => {
      if (filter.tag) return Promise.resolve(links.find((l) => l.tag === filter.tag) ?? null);
      // createLink asks for the user's last link (highest order).
      const own = links
        .filter((l) => l.userId === filter.userId)
        .sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
      return Promise.resolve(own[0] ?? null);
    },
    find: (filter: { userId: string; tag?: { $ne: string }; verified?: boolean }) => {
      let rows = links.filter(
        (l) =>
          l.userId === filter.userId &&
          l.tag !== filter.tag?.$ne &&
          (filter.verified === undefined || l.verified === filter.verified),
      );
      const cursor = {
        sort: () => {
          rows = [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          return cursor;
        },
        limit: (n: number) => {
          rows = rows.slice(0, n);
          return cursor;
        },
        toArray: () => Promise.resolve(rows),
      };
      return cursor;
    },
    updateOne: (filter: unknown, update: Update['update']) => {
      updates.push({ filter, update });
      return Promise.resolve();
    },
  };
  const db = { collection: () => collection } as unknown as Db;
  const clashClient = {
    verifyPlayerOrThrow: () => Promise.resolve(false),
    getPlayerOrThrow: (tag: string) =>
      Promise.resolve({ tag, name: 'Player', clan: { tag: '#CLAN' } }),
    getClanOrThrow: (tag: string) => Promise.resolve({ tag, memberList: clanMembers }),
  };
  const discordOauth = {
    getUser: () => Promise.resolve({ username: 'user', discriminator: '0', global_name: null }),
  };
  const service = new LinksService(clashClient as never, discordOauth as never, null as never, db);
  return { service, updates };
};

describe('LinksService.setDefaultLink', () => {
  it("moves the link below the user's other links", async () => {
    const { service, updates } = createService([
      { tag: '#A', userId: 'u1', order: 0 },
      { tag: '#B', userId: 'u1', order: 3 },
    ]);

    await service.setDefaultLink({ userId: 'u1', playerTag: '#B' });

    expect(updates).toHaveLength(1);
    expect(updates[0].filter).toEqual({ tag: '#B' });
    expect(updates[0].update.$set.order).toBe(-1);
  });

  it('breaks a tie so the chosen link is strictly first', async () => {
    const { service, updates } = createService([
      { tag: '#A', userId: 'u1', order: 0 },
      { tag: '#B', userId: 'u1', order: 0 },
    ]);

    await service.setDefaultLink({ userId: 'u1', playerTag: '#B' });

    expect(updates[0].update.$set.order).toBe(-1);
  });

  it('does nothing when the link is already the default', async () => {
    const { service, updates } = createService([
      { tag: '#A', userId: 'u1', order: -2 },
      { tag: '#B', userId: 'u1', order: 0 },
    ]);

    await service.setDefaultLink({ userId: 'u1', playerTag: '#A' });

    expect(updates).toHaveLength(0);
  });

  it("refuses someone else's link", async () => {
    const { service, updates } = createService([{ tag: '#A', userId: 'u2', order: 0 }]);

    await expect(service.setDefaultLink({ userId: 'u1', playerTag: '#A' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(updates).toHaveLength(0);
  });

  it('refuses a tag that is not linked', async () => {
    const { service } = createService([]);

    await expect(service.setDefaultLink({ userId: 'u1', playerTag: '#X' })).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('LinksService.createLink', () => {
  const caller = { userId: 'u1', isAdmin: false };

  it("adds a new account after the user's other links", async () => {
    const { service, updates } = createService([
      { tag: '#A', userId: 'u1', order: -1 },
      { tag: '#B', userId: 'u1', order: 2 },
    ]);

    await service.createLink(caller, { playerTag: '#C', userId: 'u1' } as never);

    expect(updates[0].update.$set.order).toBe(3);
    expect(updates[0].update.$setOnInsert).not.toHaveProperty('order');
  });

  it("gives the user's first account order 0", async () => {
    const { service, updates } = createService([]);

    await service.createLink(caller, { playerTag: '#C', userId: 'u1' } as never);

    expect(updates[0].update.$set.order).toBe(0);
  });

  it('keeps the place of an account the user already owns', async () => {
    const { service, updates } = createService([
      { tag: '#A', userId: 'u1', order: 0 },
      { tag: '#B', userId: 'u1', order: 5 },
    ]);

    await service.createLink(caller, { playerTag: '#A', userId: 'u1' } as never);

    expect(updates[0].update.$set).not.toHaveProperty('order');
  });

  it('refuses to link a tag to another user', async () => {
    const { service, updates } = createService([]);

    await expect(
      service.createLink(caller, { playerTag: '#C', userId: 'u2' } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(updates).toHaveLength(0);
  });

  it('refuses a Leader whose account is not verified', async () => {
    const { service, updates } = createService(
      [{ tag: '#L', userId: 'u1', verified: false }],
      [{ tag: '#L', role: 'leader' }],
    );

    await expect(
      service.createLink(caller, { playerTag: '#C', userId: 'u2' } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(updates).toHaveLength(0);
  });

  it("lets a verified Co-Leader of the player's clan link for another user", async () => {
    const { service, updates } = createService(
      [{ tag: '#L', userId: 'u1', verified: true }],
      [{ tag: '#L', role: 'coLeader' }],
    );

    await service.createLink(caller, { playerTag: '#C', userId: 'u2' } as never);

    expect(updates[0].update.$set.userId).toBe('u2');
  });

  it('lets an admin link for another user', async () => {
    const { service, updates } = createService([]);

    await service.createLink({ userId: 'u1', isAdmin: true }, {
      playerTag: '#C',
      userId: 'u2',
    } as never);

    expect(updates[0].update.$set.userId).toBe('u2');
  });
});
