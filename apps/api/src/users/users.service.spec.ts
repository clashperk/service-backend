import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { UsersService } from './users.service';

jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

const USER = '111111111111111111';

type Doc = Record<string, unknown>;

const clans = new Map<string, { tag: string; name: string }>();
const clashClan = (tag: string, name: string) => clans.set(tag, { tag, name });

beforeEach(() => {
  clans.clear();
  clashClan('#2PP', 'The Order');
});

const setup = (user?: Doc) => {
  const docs: Doc[] = user ? [{ userId: USER, ...user }] : [];
  const collection = {
    findOne: (filter: Doc) => Promise.resolve(docs.find((d) => d.userId === filter.userId) ?? null),
    updateOne: (filter: Doc, update: Record<string, Doc>, options?: { upsert?: boolean }) => {
      let doc = docs.find((d) => d.userId === filter.userId);
      if (!doc && !options?.upsert) return Promise.resolve();
      if (!doc) docs.push((doc = { ...filter, ...update.$setOnInsert }));
      Object.assign(doc, update.$set ?? {});
      for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
      for (const [key, match] of Object.entries(update.$pull ?? {})) {
        const list = (doc[key] as Doc[] | undefined) ?? [];
        doc[key] = list.filter((item) => item.tag !== (match as Doc).tag);
      }
      return Promise.resolve();
    },
  };
  const clash = {
    getClan: jest.fn((tag: string) => Promise.resolve(clans.get(tag) ?? null)),
  };
  const service = new UsersService(
    { collection: () => collection } as unknown as Db,
    clash as never,
  );
  return { service, docs, clash };
};

describe('UsersService', () => {
  it('reads nothing set as nulls', async () => {
    await expect(setup().service.getSettings(USER)).resolves.toEqual({
      clan: null,
      savedClans: [],
      timezone: null,
    });
  });

  it("sets the default clan from the game's record and clears it", async () => {
    const { service, docs, clash } = setup({ lastSearchedClanTag: '#ABC' });
    const result = await service.setDefaultClan(USER, '2pp');
    expect(clash.getClan).toHaveBeenCalledWith('#2PP');
    expect(docs[0].clan).toEqual({ tag: '#2PP', name: 'The Order' });
    expect(result.clan).toEqual({ tag: '#2PP', name: 'The Order' });

    await service.clearDefaultClan(USER);
    expect(docs[0]).toEqual({ userId: USER, lastSearchedClanTag: '#ABC' });
  });

  it('rejects a clan tag that the game does not know', async () => {
    await expect(setup().service.setDefaultClan(USER, '#NOPE')).rejects.toThrow(NotFoundException);
  });

  it('saves clans once each, keeps their order, and removes them', async () => {
    const { service, docs } = setup({ savedClans: [{ tag: '#2PP', name: 'Old name' }] });
    clashClan('#9GQ', 'Second');
    await service.saveClan(USER, '#9gq');
    const result = await service.saveClan(USER, '2pp');
    expect(result.savedClans).toEqual([
      { tag: '#2PP', name: 'The Order' },
      { tag: '#9GQ', name: 'Second' },
    ]);

    await service.unsaveClan(USER, '2PP');
    expect(docs[0].savedClans).toEqual([{ tag: '#9GQ', name: 'Second' }]);
  });

  it('stops at 50 saved clans', async () => {
    const savedClans = Array.from({ length: 50 }, (_, i) => ({ tag: `#X${i}`, name: `${i}` }));
    await expect(setup({ savedClans }).service.saveClan(USER, '#2PP')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('stores a timezone as /timezone does, and rejects unknown IDs', async () => {
    const { service, docs } = setup();
    const result = await service.setTimezone(USER, 'Asia/Kolkata');
    expect(docs[0].timezone).toEqual({
      id: 'Asia/Kolkata',
      name: 'India Standard Time',
      offset: 19800,
      location: 'Kolkata',
    });
    expect(result.timezone).toEqual({
      id: 'Asia/Kolkata',
      name: 'India Standard Time',
      location: 'Kolkata',
    });
    await expect(service.setTimezone(USER, 'Mars/Olympus')).rejects.toThrow(BadRequestException);

    await service.clearTimezone(USER);
    expect(docs[0].timezone).toBeUndefined();
  });
});
