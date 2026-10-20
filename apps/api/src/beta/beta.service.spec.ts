import { NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections } from '../db';
import { BetaService } from './beta.service';

type Doc = Record<string, unknown>;

const setup = (beta: Doc[] = []) => {
  const data: Record<string, Doc[]> = {
    [Collections.BETA_GUILDS]: beta,
    [Collections.BOT_GUILDS]: [{ guild: '111111111111111111', name: 'Pugs', iconUrl: null }],
  };
  const collection = (name: string) => {
    const docs = data[name];
    return {
      countDocuments: (filter: Doc) =>
        Promise.resolve(docs.filter((d) => d.guildId === filter.guildId).length),
      find: (filter: { guild?: { $in: string[] } }) => ({
        toArray: () =>
          Promise.resolve(
            filter.guild ? docs.filter((d) => filter.guild!.$in.includes(d.guild as string)) : docs,
          ),
      }),
      bulkWrite: (ops: { updateOne: { filter: Doc; update: { $setOnInsert: Doc } } }[]) => {
        for (const { updateOne } of ops) {
          if (!docs.some((d) => d.guildId === updateOne.filter.guildId)) {
            docs.push({ ...updateOne.update.$setOnInsert });
          }
        }
        return Promise.resolve();
      },
      deleteOne: (filter: Doc) => {
        const index = docs.findIndex((d) => d.guildId === filter.guildId);
        if (index >= 0) docs.splice(index, 1);
        return Promise.resolve({ deletedCount: index >= 0 ? 1 : 0 });
      },
    };
  };
  return {
    service: new BetaService({ collection } as unknown as Db),
    docs: data[Collections.BETA_GUILDS],
  };
};

describe('BetaService', () => {
  it('adds servers once, keeping the first note, and names known ones', async () => {
    const { service, docs } = setup([
      { guildId: '111111111111111111', note: 'first', addedBy: 'a', createdAt: new Date(0) },
    ]);
    const result = await service.add({
      guildIds: ['111111111111111111', '222222222222222222', '222222222222222222'],
      note: 'second',
      addedBy: 'b',
    });
    expect(docs).toHaveLength(2);
    expect(result.guilds.find((g) => g.guildId === '111111111111111111')).toMatchObject({
      name: 'Pugs',
      note: 'first',
      addedBy: 'a',
    });
    expect(result.guilds.find((g) => g.guildId === '222222222222222222')).toMatchObject({
      name: null,
      note: 'second',
    });
    await expect(service.isBeta('222222222222222222')).resolves.toBe(true);
    await expect(service.listIds()).resolves.toEqual({
      guildIds: ['111111111111111111', '222222222222222222'],
    });
  });

  it('removes a server, and says so when it was not in beta', async () => {
    const { service } = setup([{ guildId: '111111111111111111', addedBy: 'a' }]);
    await service.remove('111111111111111111');
    await expect(service.isBeta('111111111111111111')).resolves.toBe(false);
    await expect(service.remove('111111111111111111')).rejects.toThrow(NotFoundException);
  });
});
