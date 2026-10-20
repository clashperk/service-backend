import { NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Collections } from '../db';
import { ClanLogInput, ClanLogType } from './dto';
import { GuildLogsService } from './guild-logs.service';

jest.mock('@app/discord-oauth', () => ({ DiscordOauthService: class {} }));

const GUILD = '111111111111111111';
const CHANNEL = '222222222222222222';
const OTHER_CHANNEL = '333333333333333333';
const TAG = '#2JQV9QL2Q';
const clanId = new ObjectId();

type Doc = Record<string, unknown>;

const setup = (logs: Doc[] = []) => {
  const updates: Doc[] = [];
  const matches = (doc: Doc, filter: Doc) =>
    Object.entries(filter).every(([key, value]) => doc[key] === value);
  const collections: Record<string, unknown> = {
    [Collections.CLAN_STORES]: {
      findOne: (filter: Doc) =>
        Promise.resolve(filter.guild === GUILD && filter.tag === TAG ? { _id: clanId } : null),
    },
    [Collections.CLAN_LOGS]: {
      findOne: (filter: Doc) => Promise.resolve(logs.find((log) => matches(log, filter)) ?? null),
      findOneAndUpdate: (filter: Doc, update: Doc) => {
        updates.push(update);
        const set = update.$set as Doc;
        const doc = { _id: new ObjectId(), ...filter, ...set, updatedAt: new Date() };
        return Promise.resolve(doc);
      },
      deleteOne: (filter: Doc) =>
        Promise.resolve({ deletedCount: logs.some((log) => matches(log, filter)) ? 1 : 0 }),
    },
  };
  const db = { collection: (name: string) => collections[name] } as unknown as Db;
  const discord = {
    checkChannel: jest.fn(),
    checkRole: jest.fn(),
    resolveWebhook: jest.fn().mockResolvedValue(null),
    listChannels: jest.fn().mockResolvedValue([{ id: CHANNEL, name: 'war-feed' }]),
  };
  return { service: new GuildLogsService(db, discord as never), updates, discord };
};

const body = (overrides: Partial<ClanLogInput> = {}): ClanLogInput => ({
  channelId: CHANNEL,
  isEnabled: true,
  roleId: null,
  color: null,
  ...overrides,
});

const save = (service: GuildLogsService, input: ClanLogInput) =>
  service.save({
    guildId: GUILD,
    applicationId: null,
    clanTag: TAG,
    logType: ClanLogType.WAR_ATTACK_LOG,
    body: input,
  });

describe('GuildLogsService', () => {
  it('writes a new log in the bot format', async () => {
    const { service, updates, discord } = setup();

    const result = await save(service, body({ roleId: '444444444444444444', color: 0x378add }));

    const [update] = updates;
    expect(update.$set).toMatchObject({
      clanId,
      isEnabled: true,
      channelId: CHANNEL,
      deepLink: 'OPEN_IN_GAME',
      webhook: null,
      messageId: null,
      roleId: '444444444444444444',
      color: 0x378add,
    });
    expect(update.$min).toHaveProperty('lastPostedAt');
    expect(discord.checkChannel).toHaveBeenCalled();
    expect(discord.checkRole).toHaveBeenCalled();
    expect(result).toMatchObject({ channelName: 'war-feed', roleId: '444444444444444444' });
  });

  it('keeps the webhook and message in the same channel, and drops them when it moves', async () => {
    const existing = {
      guildId: GUILD,
      clanTag: TAG,
      logType: ClanLogType.WAR_ATTACK_LOG,
      channelId: CHANNEL,
      webhook: { id: '555555555555555555', token: 't' },
      messageId: '666666666666666666',
      roleId: '444444444444444444',
    };
    const { service, updates, discord } = setup([existing]);

    await save(service, body());
    expect(updates[0].$set).toMatchObject({
      webhook: existing.webhook,
      messageId: existing.messageId,
    });
    expect(updates[0].$unset).toEqual({ roleId: true });
    expect(discord.checkChannel).not.toHaveBeenCalled();

    await save(service, body({ channelId: OTHER_CHANNEL }));
    expect(updates[1].$set).toMatchObject({ webhook: null, messageId: null });
    expect(discord.checkChannel).toHaveBeenCalledWith(GUILD, null, OTHER_CHANNEL);
  });

  it("refuses clans the server hasn't added and logs that aren't set up", async () => {
    const { service } = setup();

    await expect(
      service.list({ guildId: GUILD, applicationId: null, clanTag: '#OTHER' }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.delete({ guildId: GUILD, clanTag: TAG, logType: ClanLogType.WAR_ATTACK_LOG }),
    ).rejects.toThrow(NotFoundException);
  });
});
