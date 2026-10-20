import { ChannelType } from 'discord-api-types/v10';
import { Db } from 'mongodb';
import { ChannelStatus } from './dto';
import { GuildDiscordService } from './guild-discord.service';

jest.mock('@app/discord-oauth', () => ({ DiscordOauthService: class {} }));

const GUILD = '111111111111111111';
const TEXT = { id: '1', name: 'clan-logs', type: ChannelType.GuildText, guild_id: GUILD };
const thread = (id: string, meta: { archived: boolean; locked: boolean }) => ({
  id,
  name: `thread-${id}`,
  type: ChannelType.PublicThread,
  guild_id: GUILD,
  parent_id: TEXT.id,
  thread_metadata: meta,
});

const setup = (lookups: Record<string, unknown>) => {
  const oauth = {
    listChannels: jest.fn().mockResolvedValue([TEXT]),
    listActiveThreads: jest
      .fn()
      .mockResolvedValue([thread('2', { archived: false, locked: false })]),
    findChannel: jest.fn(({ channelId }: { channelId: string }) => {
      const result = lookups[channelId];
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    }),
  };
  const db = {
    collection: () => ({
      findOne: () => Promise.resolve(null),
      find: () => ({ toArray: () => Promise.resolve([]) }),
    }),
  } as unknown as Db;
  const store = new Map<string, unknown>();
  const cache = {
    get: (key: string) => Promise.resolve(store.get(key)),
    set: (key: string, value: unknown) => Promise.resolve(store.set(key, value)),
  };
  return { service: new GuildDiscordService(db, oauth as never, cache as never), oauth };
};

describe('GuildDiscordService.channelInfo', () => {
  it('tells archived, locked, deleted, hidden and unchecked channels apart', async () => {
    const { service, oauth } = setup({
      '3': { channel: thread('3', { archived: true, locked: false }) },
      '4': { channel: thread('4', { archived: true, locked: true }) },
      '5': { missing: 'deleted' },
      '6': { missing: 'noAccess' },
      '7': new Error('rate limited'),
    });
    const info = await service.channelInfo(GUILD, null, ['1', '2', '3', '4', '5', '6', '7', '1']);
    expect(Object.fromEntries(info)).toEqual({
      '1': { name: 'clan-logs', status: ChannelStatus.OK, parentName: null },
      '2': { name: 'thread-2', status: ChannelStatus.OK, parentName: 'clan-logs' },
      '3': { name: 'thread-3', status: ChannelStatus.ARCHIVED, parentName: 'clan-logs' },
      '4': { name: 'thread-4', status: ChannelStatus.LOCKED, parentName: 'clan-logs' },
      '5': { name: null, status: ChannelStatus.DELETED, parentName: null },
      '6': { name: null, status: ChannelStatus.NO_ACCESS, parentName: null },
      '7': { name: null, status: ChannelStatus.UNKNOWN, parentName: null },
    });
    // Only channels missing from the server's lists are looked up one by one.
    expect(oauth.findChannel).toHaveBeenCalledTimes(5);
  });

  it('caches lookups, skips failed ones, and looks up at most 3 at a time and 25 in all', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `x${i}`);
    const { service, oauth } = setup(
      Object.fromEntries(ids.map((id) => [id, { missing: 'deleted' }])),
    );
    let inFlight = 0;
    let peak = 0;
    const find = oauth.findChannel.getMockImplementation()!;
    oauth.findChannel.mockImplementation(async (input: { channelId: string }) => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return find(input);
    });

    const first = await service.channelInfo(GUILD, null, ids);
    expect(peak).toBeLessThanOrEqual(3);
    expect(oauth.findChannel).toHaveBeenCalledTimes(25);
    expect(first.get('x0')?.status).toBe(ChannelStatus.DELETED);
    expect(first.get('x29')?.status).toBe(ChannelStatus.UNKNOWN);

    await service.channelInfo(GUILD, null, ids.slice(0, 25));
    expect(oauth.findChannel).toHaveBeenCalledTimes(25);
  });

  it('reuses the channel list for 30 seconds unless asked for a fresh one', async () => {
    const { service, oauth } = setup({});
    await service.listChannels({ guildId: GUILD, applicationId: null });
    await service.channelInfo(GUILD, null, ['1']);
    await service.listCategories({ guildId: GUILD, applicationId: null });
    expect(oauth.listChannels).toHaveBeenCalledTimes(1);
    await service.listChannels({ guildId: GUILD, applicationId: null, fresh: true });
    expect(oauth.listChannels).toHaveBeenCalledTimes(2);
  });

  it('checks a channel again fresh before rejecting it, for one made since the list was cached', async () => {
    const { service, oauth } = setup({});
    await service.listChannels({ guildId: GUILD, applicationId: null });
    oauth.listChannels.mockResolvedValue([TEXT, { ...TEXT, id: '8', name: 'new' }]);
    await expect(service.checkChannel(GUILD, null, '8')).resolves.toBeUndefined();
    await expect(service.checkChannel(GUILD, null, '99')).rejects.toThrow('Pick a text');
  });

  it("treats another server's channel as deleted", async () => {
    const { service } = setup({ '9': { channel: { ...TEXT, id: '9', guild_id: '222' } } });
    const info = await service.channelInfo(GUILD, null, ['9']);
    expect(info.get('9')?.status).toBe(ChannelStatus.DELETED);
  });
});
