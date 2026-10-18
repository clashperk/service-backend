import { NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { RostersService } from './rosters.service';

// clash-client pulls in JSON the test setup can't load; deleteRosterMembers never calls it.
jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

type Roster = { _id: ObjectId; guildId: string; members: { tag: string }[] };

type Filter = { _id: ObjectId; guildId?: string };

const matches = (roster: Roster, filter: Filter) =>
  roster._id.equals(filter._id) &&
  (filter.guildId === undefined || roster.guildId === filter.guildId);

const createService = (rosters: Roster[]) => {
  const collection = {
    findOne: (filter: Filter) => Promise.resolve(rosters.find((r) => matches(r, filter)) ?? null),
    updateOne: (filter: Filter, update: { $pull: { members: { tag: { $in: string[] } } } }) => {
      const roster = rosters.find((r) => matches(r, filter));
      if (roster) {
        const tags = update.$pull.members.tag.$in;
        roster.members = roster.members.filter((m) => !tags.includes(m.tag));
      }
      return Promise.resolve();
    },
  };
  const db = { collection: () => collection } as unknown as Db;
  return new RostersService(null as never, db);
};

describe('RostersService.deleteRosterMembers', () => {
  const rosterId = new ObjectId();

  it("returns the guild's roster without the removed members", async () => {
    const service = createService([
      { _id: rosterId, guildId: 'g1', members: [{ tag: '#A' }, { tag: '#B' }] },
    ]);

    const roster = await service.deleteRosterMembers({
      rosterId: rosterId.toHexString(),
      guildId: 'g1',
      playerTags: ['#A'],
    });

    expect(roster.members).toEqual([{ tag: '#B' }]);
  });

  it("returns 404 and leaves another guild's roster untouched", async () => {
    const rosters = [{ _id: rosterId, guildId: 'g2', members: [{ tag: '#A' }] }];
    const service = createService(rosters);

    await expect(
      service.deleteRosterMembers({
        rosterId: rosterId.toHexString(),
        guildId: 'g1',
        playerTags: ['#A'],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(rosters[0].members).toEqual([{ tag: '#A' }]);
  });
});
