import { NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { WarsService } from './wars.service';

// clash-client pulls in JSON the test setup can't load; getClanWar never calls it.
jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

type War = { id: number; clan: { tag: string }; opponent: { tag: string } };

type Filter = { id: number; $or: Record<'clan.tag' | 'opponent.tag', string>[] };

const createService = (wars: War[]) => {
  const tagAt = (war: War, path: string) => (path === 'clan.tag' ? war.clan : war.opponent).tag;
  const collection = {
    findOne: (filter: Filter) =>
      Promise.resolve(
        wars.find(
          (war) =>
            war.id === filter.id &&
            filter.$or.some((cond) =>
              Object.entries(cond).every(([path, tag]) => tagAt(war, path) === tag),
            ),
        ) ?? null,
      ),
  };
  const db = { collection: () => collection } as unknown as Db;
  return new WarsService(db, null as never);
};

const war = (clan: string, opponent: string): War => ({
  id: 7,
  clan: { tag: clan, stars: 3, destructionPercentage: 100 } as War['clan'],
  opponent: { tag: opponent, stars: 1, destructionPercentage: 50 } as War['opponent'],
});

describe('WarsService.getClanWar', () => {
  it("returns the war from the requested clan's side", async () => {
    const service = createService([war('#A', '#B')]);

    const result = await service.getClanWar({ clanTag: '#B', warId: '7' });

    expect(result.clan.tag).toBe('#B');
    expect(result.opponent.tag).toBe('#A');
  });

  it('returns 404 for a war the clan was not in', async () => {
    const service = createService([war('#A', '#B')]);

    await expect(service.getClanWar({ clanTag: '#C', warId: '7' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
