import { NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections } from '../db';
import { GuildServerLogsService } from './guild-server-logs.service';
import { channelState } from '../../test/fakes';

vi.mock('@app/discord-rest', () => ({ DiscordRestService: class {} }));

const GUILD = '111111111111111111';
const CHANNEL = (n: number) => `33333333333333333${n}`;
const ROLE = '222222222222222222';
const HOOK = { id: '444444444444444444', token: 'secret' };

type Doc = Record<string, unknown>;

const setup = (opts: { settings?: Doc; flagAlert?: Doc } = {}) => {
  const data: Record<string, Doc[]> = {
    [Collections.SETTINGS]: opts.settings ? [{ guildId: GUILD, ...opts.settings }] : [],
    [Collections.FLAG_ALERT_LOGS]: opts.flagAlert ? [{ guildId: GUILD, ...opts.flagAlert }] : [],
  };
  const setPath = (doc: Doc, path: string, value: unknown) => {
    const keys = path.split('.');
    const last = keys.pop()!;
    const parent = keys.reduce((d, k) => d[k] as Doc, doc);
    parent[last] = value;
  };
  const collection = (name: string) => {
    const docs = data[name];
    const find = (filter: Doc) => docs.find((d) => d.guildId === filter.guildId);
    return {
      findOne: (filter: Doc) => Promise.resolve(find(filter) ?? null),
      updateOne: (filter: Doc, update: Record<string, Doc>, options?: { upsert?: boolean }) => {
        let doc = find(filter);
        if (!doc && !options?.upsert) return Promise.resolve();
        if (!doc) docs.push((doc = { ...filter, ...update.$setOnInsert }));
        for (const [key, value] of Object.entries(update.$set ?? {})) setPath(doc, key, value);
        for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
        return Promise.resolve();
      },
      deleteOne: (filter: Doc) => {
        const index = docs.findIndex((d) => d.guildId === filter.guildId);
        if (index >= 0) docs.splice(index, 1);
        return Promise.resolve({ deletedCount: index >= 0 ? 1 : 0 });
      },
    };
  };
  const discord = {
    checkChannel: vi.fn(),
    checkRole: vi.fn(),
    resolveWebhook: vi.fn().mockResolvedValue(null),
    channelStatuses: vi.fn((_g: string, _a: string | null, ids: string[]) =>
      Promise.resolve(new Map(ids.map((id) => [id, channelState(`channel-${id.slice(-1)}`)]))),
    ),
  };
  const service = new GuildServerLogsService({ collection } as unknown as Db, discord as never);
  const settings = () => data[Collections.SETTINGS][0];
  const flagAlert = () => data[Collections.FLAG_ALERT_LOGS][0];
  return { service, discord, settings, flagAlert };
};

describe('GuildServerLogsService', () => {
  it('reads every log with channel names, and null for ones not set up', async () => {
    const { service } = setup({
      settings: {
        eventsChannel: CHANNEL(1),
        welcomeLog: {
          enabled: false,
          channelId: CHANNEL(2),
          webhook: null,
          buttons: ['link-button'],
          welcomeText: 'Hi {{user}}',
          description: 'Link up',
          bannerImage: '',
          embedColor: 0xff0000,
        },
      },
    });
    await expect(service.get(GUILD, null)).resolves.toEqual({
      flagAlert: null,
      rosterChangelog: null,
      maintenance: { channelId: CHANNEL(1), channelName: 'channel-1' },
      welcome: {
        channelId: CHANNEL(2),
        channelName: 'channel-2',
        enabled: false,
        welcomeText: 'Hi {{user}}',
        description: 'Link up',
        bannerImage: null,
        embedColor: 0xff0000,
      },
    });
  });

  it('sets up flag alerts as the bot does and drops the webhook on a new channel', async () => {
    const { service, discord, settings, flagAlert } = setup({
      flagAlert: { channelId: CHANNEL(1), roleId: null, useAutoRole: false, webhook: HOOK },
    });
    const result = await service.saveFlagAlert({
      guildId: GUILD,
      applicationId: null,
      body: { channelId: CHANNEL(2), roleId: ROLE, useAutoRole: true },
    });
    expect(discord.checkChannel).toHaveBeenCalledWith(GUILD, null, CHANNEL(2));
    expect(discord.checkRole).toHaveBeenCalledWith(GUILD, null, ROLE);
    expect(flagAlert()).toMatchObject({ channelId: CHANNEL(2), roleId: ROLE, useAutoRole: true });
    expect(flagAlert().webhook).toBeUndefined();
    expect(settings().hasFlagAlertLog).toBe(true);
    expect(result.flagAlert).toEqual({
      channelId: CHANNEL(2),
      channelName: 'channel-2',
      roleId: ROLE,
      useAutoRole: true,
    });

    await service.deleteFlagAlert(GUILD, null);
    expect(flagAlert()).toBeUndefined();
    expect(settings().hasFlagAlertLog).toBeUndefined();
  });

  it('keeps the webhook when the channel stays the same', async () => {
    const { service, discord, settings } = setup({
      settings: { rosterChangeLog: { channelId: CHANNEL(1), webhook: HOOK } },
    });
    await service.saveRosterChangelog({
      guildId: GUILD,
      applicationId: null,
      body: { channelId: CHANNEL(1) },
    });
    expect(discord.resolveWebhook).not.toHaveBeenCalled();
    expect(settings().rosterChangeLog).toEqual({ channelId: CHANNEL(1), webhook: HOOK });

    discord.resolveWebhook.mockResolvedValueOnce(HOOK);
    await service.saveRosterChangelog({
      guildId: GUILD,
      applicationId: null,
      body: { channelId: CHANNEL(2) },
    });
    expect(discord.checkChannel).toHaveBeenCalledWith(GUILD, null, CHANNEL(2));
    expect(settings().rosterChangeLog).toEqual({ channelId: CHANNEL(2), webhook: HOOK });
  });

  it('saves the welcome message and turning it off keeps it', async () => {
    const { service, settings } = setup();
    await service.saveWelcome({
      guildId: GUILD,
      applicationId: null,
      body: { channelId: CHANNEL(1), welcomeText: 'Hey {{user}}', description: '' },
    });
    expect(settings().welcomeLog).toEqual({
      enabled: true,
      channelId: CHANNEL(1),
      webhook: null,
      buttons: ['link-button'],
      welcomeText: 'Hey {{user}}',
      description: '',
      bannerImage: null,
      embedColor: null,
    });

    const result = await service.delete(GUILD, null, 'welcomeLog');
    expect(result.welcome).toMatchObject({ enabled: false, welcomeText: 'Hey {{user}}' });
    await expect(service.delete(GUILD, null, 'welcomeLog')).rejects.toThrow(NotFoundException);
  });

  it('sets and clears the maintenance channel', async () => {
    const { service, settings } = setup();
    await service.saveMaintenance({
      guildId: GUILD,
      applicationId: null,
      body: { channelId: CHANNEL(3) },
    });
    expect(settings().eventsChannel).toBe(CHANNEL(3));
    const result = await service.delete(GUILD, null, 'eventsChannel');
    expect(result.maintenance).toBeNull();
    expect(settings().eventsChannel).toBeUndefined();
  });
});
