import { Db } from 'mongodb';
import { SubscribersService } from './subscribers.service';

const record = {
  id: 'p1',
  name: 'Chief',
  userId: '111111111111111111',
  username: 'chief',
  rewardId: '5352215',
  guilds: [{ id: '222222222222222222', name: 'Clan HQ', limit: 10 }],
  active: true,
  declined: false,
  cancelled: false,
  status: 'active_patron',
  entitledAmount: 1000,
  lifetimeSupport: 12000,
  applicationId: '333333333333333333',
  createdAt: new Date('2025-01-01'),
};

describe('SubscribersService', () => {
  it('lists subscriptions without contact details, active first', async () => {
    const find = vi.fn().mockReturnValue({ toArray: () => Promise.resolve([record]) });
    const service = new SubscribersService({ collection: () => ({ find }) } as unknown as Db);

    await expect(service.list()).resolves.toEqual({
      subscribers: [
        {
          id: 'p1',
          provider: 'patreon',
          name: 'Chief',
          discordUserId: '111111111111111111',
          discordUsername: 'chief',
          plan: 'gold',
          tier: null,
          active: true,
          status: 'active_patron',
          billedCents: 1000,
          cadence: 'monthly',
          monthlyCents: 1000,
          lifetimeCents: 12000,
          customBot: true,
          servers: [{ id: '222222222222222222', name: 'Clan HQ', clanLimit: 10 }],
          lastChargeDate: null,
          createdAt: record.createdAt,
        },
      ],
    });
    expect(find).toHaveBeenCalledWith(
      {},
      { projection: { email: 0 }, sort: { active: -1, createdAt: -1 } },
    );
  });

  it('spreads a yearly charge over 12 months', async () => {
    const yearly = { ...record, rewardId: '3705318', entitledAmount: 3240 };
    const find = vi.fn().mockReturnValue({ toArray: () => Promise.resolve([yearly]) });
    const service = new SubscribersService({ collection: () => ({ find }) } as unknown as Db);
    const [subscriber] = (await service.list()).subscribers;
    expect(subscriber).toMatchObject({
      plan: 'bronze',
      billedCents: 3240,
      cadence: 'yearly',
      monthlyCents: 270,
    });
  });
});
