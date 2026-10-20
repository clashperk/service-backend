import { Db, ObjectId } from 'mongodb';
import { clanGamesWindow, ReminderSchedulesService } from './reminder-schedules.service';

jest.mock('@app/clash-client', () => ({ ClashClient: class {} }));

const HOUR = 60 * 60 * 1000;
// Clash API time format, e.g. 20261020T120000.000Z.
const clashTime = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '');

const war = (tag: string, opponent: string, endsIn: number, prepHours = 23) => {
  const end = Date.now() + endsIn;
  const start = end - 24 * HOUR;
  return {
    state: 'inWar',
    clan: { tag, name: 'Ours' },
    opponent: { tag: opponent, name: 'Theirs' },
    preparationStartTime: clashTime(start - prepHours * HOUR),
    startTime: clashTime(start),
    endTime: clashTime(end),
  };
};

const setup = (client: Record<string, jest.Mock>) => {
  const inserted: Record<string, unknown>[] = [];
  const collection = {
    deleteMany: jest.fn().mockResolvedValue({}),
    insertMany: jest.fn((docs: Record<string, unknown>[]) => inserted.push(...docs)),
  };
  const db = { collection: () => collection } as unknown as Db;
  return { service: new ReminderSchedulesService(db, client as never), inserted, collection };
};

const reminder = (duration: number) => ({
  _id: new ObjectId(),
  guild: '1',
  clans: ['#A'],
  duration,
});

describe('ReminderSchedulesService', () => {
  it('schedules the regular war and the CWL round the clan is in', async () => {
    const { service, inserted } = setup({
      getCurrentWar: jest
        .fn()
        .mockResolvedValue({ res: { ok: true }, body: war('#A', '#B', 10 * HOUR) }),
      getClanWarLeagueGroup: jest.fn().mockResolvedValue({
        res: { ok: true },
        body: { state: 'inWar', rounds: [{ warTags: ['#W1', '#W2'] }, { warTags: ['#0'] }] },
      }),
      getClanWarLeagueRound: jest.fn((warTag: string) =>
        Promise.resolve({
          res: { ok: true },
          body: warTag === '#W2' ? war('#C', '#A', 5 * HOUR) : war('#D', '#E', 5 * HOUR),
        }),
      ),
    });

    await service.reschedule('clanWars', reminder(HOUR));

    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({
      tag: '#A',
      warTag: null,
      isFriendly: false,
      triggered: false,
    });
    // The CWL war is stored from the reminder clan's side.
    expect(inserted[1]).toMatchObject({ tag: '#A', name: 'Theirs', warTag: '#W2' });
  });

  it('skips runs whose reminder time has passed and flags friendly wars', async () => {
    const { service, inserted } = setup({
      getCurrentWar: jest
        .fn()
        .mockResolvedValue({ res: { ok: true }, body: war('#A', '#B', 3 * HOUR, 2) }),
      getClanWarLeagueGroup: jest.fn().mockResolvedValue({ res: { ok: false } }),
    });

    await service.reschedule('clanWars', reminder(4 * HOUR));
    expect(inserted).toHaveLength(0);

    await service.reschedule('clanWars', reminder(HOUR));
    expect(inserted[0]).toMatchObject({ isFriendly: true });
  });

  it('places Clan Games on the 22nd at 08:00 UTC for six days', () => {
    const { startTime, endTime } = clanGamesWindow(new Date(Date.UTC(2026, 9, 3)));
    expect(startTime.toISOString()).toBe('2026-10-22T08:00:00.000Z');
    expect(endTime.toISOString()).toBe('2026-10-28T08:00:00.000Z');
  });
});
