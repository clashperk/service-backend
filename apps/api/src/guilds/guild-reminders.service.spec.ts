import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Collections } from '../db';
import { ClanWarReminderInput } from './dto';
import { GuildDiscordService } from './guild-discord.service';
import { GuildRemindersService } from './guild-reminders.service';
import { memoryCache } from '../../test/fakes';

jest.mock('@app/clash-client', () => ({ ClashClient: class {} }));
jest.mock('@app/discord-oauth', () => ({ DiscordOauthService: class {} }));

const GUILD = '111111111111111111';
const CHANNEL = '222222222222222222';
const THREAD = '444444444444444444';
const FORUM = '555555555555555555';
const POST = '666666666666666666';
const MINUTE = 60_000;

type Store = Record<string, Record<string, unknown>[]>;

const matches = (doc: Record<string, unknown>, filter: Record<string, unknown>) =>
  Object.entries(filter).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === 'object' && !(cond instanceof ObjectId)) {
      const op = cond as Record<string, unknown>;
      if ('$in' in op) return (op.$in as unknown[]).includes(value);
      if ('$ne' in op) return value != null && value !== op.$ne;
      if ('$exists' in op) return (value !== undefined) === op.$exists;
    }
    if (cond instanceof ObjectId) return cond.equals(value as ObjectId);
    return value === cond;
  });

const threads = [
  { id: THREAD, name: 'war calls', type: 11, parent_id: CHANNEL },
  { id: POST, name: 'recruiting', type: 11, parent_id: FORUM },
];

const setup = (store: Store, webhook: { guild_id: string; channel_id: string } | null = null) => {
  const collection = (name: string) => {
    store[name] ??= [];
    const docs = store[name];
    return {
      find: (filter: Record<string, unknown>) => ({
        toArray: () => Promise.resolve(docs.filter((doc) => matches(doc, filter))),
      }),
      findOne: (filter: Record<string, unknown>) =>
        Promise.resolve(docs.find((doc) => matches(doc, filter)) ?? null),
      countDocuments: (filter: Record<string, unknown>) =>
        Promise.resolve(docs.filter((doc) => matches(doc, filter)).length),
      insertOne: (doc: Record<string, unknown>) => Promise.resolve(docs.push(doc)),
      updateOne: (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
        const doc = docs.find((d) => matches(d, filter));
        if (doc) Object.assign(doc, update.$set);
        return Promise.resolve();
      },
      deleteOne: (filter: Record<string, unknown>) => {
        const index = docs.findIndex((doc) => matches(doc, filter));
        if (index >= 0) docs.splice(index, 1);
        return Promise.resolve();
      },
    };
  };
  const db = { collection } as unknown as Db;
  const discord = {
    listChannels: () =>
      Promise.resolve([
        { id: CHANNEL, name: 'war', type: 0, position: 1 },
        { id: FORUM, name: 'clans', type: 15, position: 2 },
      ]),
    listActiveThreads: () => Promise.resolve(threads),
    getChannel: ({ channelId }: { channelId: string }) =>
      Promise.resolve(
        threads.find((thread) => thread.id === channelId) ?? { id: channelId, type: 0 },
      ),
    getWebhook: () => Promise.resolve(webhook),
  };
  const schedules = { reschedule: jest.fn(), clear: jest.fn() };
  return {
    service: new GuildRemindersService(
      db,
      new GuildDiscordService(db, discord as never, memoryCache()),
      schedules as never,
    ),
    schedules,
  };
};

const input = (overrides: Partial<ClanWarReminderInput> = {}): ClanWarReminderInput => ({
  channelId: CHANNEL,
  message: ' Attack! ',
  duration: 120 * MINUTE,
  roles: ['leader', 'member'],
  linkedOnly: false,
  clans: ['#2JQV9QL2Q'],
  disabled: false,
  townHalls: [16, 17],
  remaining: [1, 2],
  warTypes: ['normal', 'cwl'],
  smartSkip: false,
  silent: false,
  ...overrides,
});

const clanStore = (): Store => ({
  [Collections.CLAN_STORES]: [{ guild: GUILD, tag: '#2JQV9QL2Q' }],
});

describe('GuildRemindersService', () => {
  it('saves a war reminder in the bot format and schedules it', async () => {
    const store = clanStore();
    const { service, schedules } = setup(store);

    await service.create('clanWars', { guildId: GUILD, applicationId: null, body: input() });

    const [saved] = store[Collections.CLAN_WAR_REMINDERS];
    expect(saved).toMatchObject({
      guild: GUILD,
      channel: CHANNEL,
      message: 'Attack!',
      webhook: null,
      remaining: [1, 2],
    });
    expect(saved).not.toHaveProperty('channelId');
    expect(schedules.reschedule).toHaveBeenCalledWith('clanWars', saved);
  });

  it('reuses a webhook ClashPerk already has in the channel', async () => {
    const store = clanStore();
    store[Collections.CLAN_LOGS] = [
      { guildId: GUILD, channelId: CHANNEL, webhook: { id: '333333333333333333', token: 't' } },
    ];
    const { service } = setup(store);

    await service.create('clanWars', { guildId: GUILD, applicationId: null, body: input() });

    expect(store[Collections.CLAN_WAR_REMINDERS][0].webhook).toEqual({
      id: '333333333333333333',
      token: 't',
    });
  });

  it('posts in a thread through the webhook of its channel', async () => {
    const store = clanStore();
    store[Collections.CLAN_LOGS] = [
      { guildId: GUILD, channelId: CHANNEL, webhook: { id: '333333333333333333', token: 't' } },
    ];
    const { service } = setup(store);

    await service.create('clanWars', {
      guildId: GUILD,
      applicationId: null,
      body: input({ channelId: THREAD }),
    });

    expect(store[Collections.CLAN_WAR_REMINDERS][0]).toMatchObject({
      channel: THREAD,
      webhook: { id: '333333333333333333', token: 't' },
    });
  });

  it('takes forum posts but not the forum itself', async () => {
    const { service } = setup(clanStore(), { guild_id: GUILD, channel_id: FORUM });
    const create = (channelId: string) =>
      service.create('clanWars', {
        guildId: GUILD,
        applicationId: null,
        body: input({ channelId, webhook: { id: '333333333333333333', token: 't' } }),
      });

    await expect(create(FORUM)).rejects.toThrow(BadRequestException);
    await expect(create(POST)).resolves.toBeDefined();
  });

  it('rejects a signed-in webhook from another channel', async () => {
    const { service } = setup(clanStore(), { guild_id: GUILD, channel_id: '999999999999999999' });

    await expect(
      service.create('clanWars', {
        guildId: GUILD,
        applicationId: null,
        body: input({ webhook: { id: '333333333333333333', token: 't' } }),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects channels outside the server, clans not in it and off-step times', async () => {
    const { service } = setup(clanStore());
    const create = (body: ClanWarReminderInput) =>
      service.create('clanWars', { guildId: GUILD, applicationId: null, body });

    await expect(create(input({ channelId: '999999999999999999' }))).rejects.toThrow(
      BadRequestException,
    );
    await expect(create(input({ clans: ['#OTHER'] }))).rejects.toThrow(BadRequestException);
    await expect(create(input({ duration: 50 * MINUTE }))).rejects.toThrow(BadRequestException);
    await expect(create(input({ duration: 49 * 60 * MINUTE }))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('stops at the bot limit unless the server is a supporter', async () => {
    const store = clanStore();
    store[Collections.CLAN_WAR_REMINDERS] = Array.from({ length: 25 }, () => ({ guild: GUILD }));
    const { service } = setup(store);
    const create = () =>
      service.create('clanWars', { guildId: GUILD, applicationId: null, body: input() });

    await expect(create()).rejects.toThrow(ForbiddenException);

    store[Collections.PATRONS] = [{ 'active': true, 'guilds.id': GUILD }];
    await expect(create()).resolves.toHaveProperty('id');
  });

  it("only edits and deletes this server's reminders", async () => {
    const store = clanStore();
    const id = new ObjectId();
    store[Collections.CLAN_WAR_REMINDERS] = [{ _id: id, guild: 'other', channel: CHANNEL }];
    const { service, schedules } = setup(store);

    await expect(
      service.update('clanWars', {
        guildId: GUILD,
        applicationId: null,
        reminderId: id.toHexString(),
        body: input(),
      }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.delete('clanWars', { guildId: GUILD, reminderId: id.toHexString() }),
    ).rejects.toThrow(NotFoundException);
    expect(schedules.clear).not.toHaveBeenCalled();
  });
});
