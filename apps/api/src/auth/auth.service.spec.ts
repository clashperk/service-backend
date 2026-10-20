import { Db } from 'mongodb';
import { Collections } from '../db';
import { AuthService } from './auth.service';

jest.mock('@app/discord-oauth', () => ({ DiscordOauthService: class {} }));

const GUILD = '111111111111111111';
const OTHER = '111111111111111112';
const USER = '999999999999999999';
const ROLE = (n: number) => `22222222222222222${n}`;
const MANAGE_GUILD = String(1 << 5);
const ADMINISTRATOR = String(1 << 3);

type Doc = Record<string, unknown>;

const setup = (
  opts: {
    settings?: Doc[];
    customBots?: Doc[];
    guild?: { owner_id?: string; roles?: { id: string; permissions: string }[] };
    member?: { roles: string[] } | null;
  } = {},
) => {
  const data: Record<string, Doc[]> = {
    [Collections.SETTINGS]: opts.settings ?? [],
    [Collections.CUSTOM_BOTS]: opts.customBots ?? [],
    [Collections.BOT_GUILDS]: [{ guild: GUILD, name: 'Pugs', iconUrl: null }],
  };
  const matches = (doc: Doc, filter: Doc) =>
    Object.entries(filter).every(([key, cond]) => {
      if (cond && typeof cond === 'object') {
        if ('$in' in cond) return (cond.$in as unknown[]).includes(doc[key]);
        if ('$exists' in cond) return key in doc === cond.$exists;
      }
      return doc[key] === cond;
    });
  const collection = (name: string) => ({
    findOne: (filter: Doc) =>
      Promise.resolve(data[name].find((doc) => matches(doc, filter)) ?? null),
    find: (filter: Doc) => ({
      toArray: () => Promise.resolve(data[name].filter((doc) => matches(doc, filter))),
    }),
  });
  const discord = {
    getUser: jest.fn().mockResolvedValue({ id: USER, username: 'pug', global_name: 'Pug' }),
    getGuild: jest.fn().mockResolvedValue({
      owner_id: '888888888888888888',
      roles: [{ id: GUILD, permissions: '0' }],
      ...opts.guild,
    }),
    getMember: jest.fn().mockResolvedValue(opts.member === undefined ? { roles: [] } : opts.member),
  };
  const redis = { set: jest.fn() };
  const service = new AuthService(
    redis as never,
    { collection } as unknown as Db,
    null as never,
    discord as never,
    null as never,
    null as never,
  );
  const stored = () => JSON.parse(redis.set.mock.calls[0][1] as string) as Doc;
  return { service, discord, stored };
};

const handoff = (service: AuthService, applicationId: string | null = null) =>
  service.createHandoffToken({ userId: USER, guildId: GUILD, applicationId });

describe('AuthService.createHandoffToken', () => {
  it('opens the server for its owner', async () => {
    const { service, stored } = setup({ guild: { owner_id: USER } });
    await handoff(service);
    expect(stored().guild).toEqual({ id: GUILD, name: 'Pugs', iconUrl: null });
  });

  it.each([
    ['Manage Server', MANAGE_GUILD],
    ['Administrator', ADMINISTRATOR],
  ])('opens the server with %s from a role', async (_, permissions) => {
    const { service, stored } = setup({
      guild: { roles: [{ id: ROLE(1), permissions }] },
      member: { roles: [ROLE(1)] },
    });
    await handoff(service);
    expect(stored().guildId).toBe(GUILD);
  });

  it('counts @everyone permissions', async () => {
    const { service, stored } = setup({
      guild: { roles: [{ id: GUILD, permissions: MANAGE_GUILD }] },
    });
    await handoff(service);
    expect(stored().guildId).toBe(GUILD);
  });

  it('opens the server for the bot manager role, including a legacy single ID', async () => {
    const { service, stored } = setup({
      settings: [{ guildId: GUILD, managerRole: ROLE(2) }],
      member: { roles: [ROLE(2)] },
    });
    await handoff(service);
    expect(stored().guildId).toBe(GUILD);
  });

  it('leaves the server out for a roster or links manager', async () => {
    const { service, stored } = setup({
      settings: [{ guildId: GUILD, managerRole: [ROLE(2)], rosterManagerRole: [ROLE(3)] }],
      member: { roles: [ROLE(3)] },
    });
    await handoff(service);
    expect(stored()).toMatchObject({ guildId: null, guild: null, userId: USER });
  });

  it('leaves the server out when the user left or Discord fails', async () => {
    const left = setup({ member: null });
    await handoff(left.service);
    expect(left.stored().guild).toBeNull();

    const failing = setup();
    failing.discord.getGuild.mockRejectedValueOnce(new Error('Discord is down'));
    await handoff(failing.service);
    expect(failing.stored().guild).toBeNull();
  });

  it("looks the member up with a custom bot's token", async () => {
    const { service, discord } = setup({
      customBots: [{ serviceId: '777777777777777777', token: 'custom' }],
    });
    await handoff(service, '777777777777777777');
    expect(discord.getMember).toHaveBeenCalledWith({
      guildId: GUILD,
      userId: USER,
      token: 'custom',
    });
  });
});

describe('AuthService.getManagedGuilds', () => {
  it('lists only servers where the member holds the bot manager role', async () => {
    const { service, discord } = setup({
      settings: [
        { guildId: GUILD, managerRole: [ROLE(1)] },
        { guildId: OTHER, managerRole: ROLE(2) },
        { guildId: '111111111111111113', managerRole: [] },
      ],
    });
    discord.getMember.mockImplementation(({ guildId }: { guildId: string }) =>
      Promise.resolve(guildId === GUILD ? { roles: [ROLE(1)] } : { roles: [ROLE(3)] }),
    );
    await expect(
      service.getManagedGuilds(USER, [GUILD, OTHER, '111111111111111113']),
    ).resolves.toEqual({ guildIds: [GUILD] });
    // A server with no manager role set needs no Discord lookup.
    expect(discord.getMember).toHaveBeenCalledTimes(2);
  });
});
