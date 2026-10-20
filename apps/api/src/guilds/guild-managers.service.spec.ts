import { BadRequestException } from '@nestjs/common';
import { Db } from 'mongodb';
import { AuthService } from '../auth/auth.service';
import { GuildManagersService } from './guild-managers.service';

jest.mock('@app/discord-oauth', () => ({ DiscordOauthService: class {} }));

const GUILD = '111111111111111111';
const OTHER = '111111111111111112';
const USER = '999999999999999999';
const ROLE = (n: number) => `22222222222222222${n}`;

type Doc = Record<string, unknown>;

const settingsCollection = (docs: Doc[]) => ({
  findOne: (filter: Doc) => Promise.resolve(docs.find((d) => d.guildId === filter.guildId) ?? null),
  find: (filter: { guildId: { $in: string[] } }) => ({
    toArray: () =>
      Promise.resolve(
        docs.filter((d) => filter.guildId.$in.includes(d.guildId as string) && 'managerRole' in d),
      ),
  }),
  updateOne: (filter: Doc, update: Record<string, Doc>) => {
    let doc = docs.find((d) => d.guildId === filter.guildId);
    if (!doc) docs.push((doc = { ...filter }));
    Object.assign(doc, update.$set ?? {});
    for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
    return Promise.resolve();
  },
});

describe('GuildManagersService', () => {
  const setup = (settings?: Doc) => {
    const docs: Doc[] = settings ? [{ guildId: GUILD, ...settings }] : [];
    const discord = {
      listRoles: jest.fn().mockResolvedValue([1, 2, 3].map((n) => ({ id: ROLE(n) }))),
    };
    const db = { collection: () => settingsCollection(docs) } as unknown as Db;
    return { service: new GuildManagersService(db, discord as never), docs, discord };
  };

  it("reads the bot's lists, including a legacy single role", async () => {
    const { service } = setup({ managerRole: ROLE(1), rosterManagerRole: [ROLE(2)] });
    await expect(service.get(GUILD)).resolves.toEqual({
      managerRoles: [ROLE(1)],
      rosterManagerRoles: [ROLE(2)],
      flagsManagerRoles: [],
      linksManagerRoles: [],
    });
  });

  it('saves lists, removes empty ones and leaves the rest alone', async () => {
    const { service, docs } = setup({ managerRole: ROLE(1), linksManagerRole: [ROLE(3)] });
    const result = await service.save({
      guildId: GUILD,
      applicationId: null,
      body: { managerRoles: [], flagsManagerRoles: [ROLE(2), ROLE(2)] },
    });
    expect(docs[0]).toEqual({
      guildId: GUILD,
      flagsManagerRole: [ROLE(2)],
      linksManagerRole: [ROLE(3)],
    });
    expect(result.managerRoles).toEqual([]);
  });

  it('rejects roles from another server', async () => {
    const { service } = setup();
    await expect(
      service.save({ guildId: GUILD, applicationId: null, body: { managerRoles: [ROLE(9)] } }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('AuthService.getManagedGuilds', () => {
  it('lists only servers where the member holds the bot manager role', async () => {
    const docs: Doc[] = [
      { guildId: GUILD, managerRole: [ROLE(1)] },
      { guildId: OTHER, managerRole: ROLE(2) },
      { guildId: '111111111111111113', managerRole: [] },
    ];
    const getMember = jest.fn(({ guildId }: { guildId: string }) =>
      Promise.resolve(guildId === GUILD ? { roles: [ROLE(1)] } : { roles: [ROLE(3)] }),
    );
    const db = { collection: () => settingsCollection(docs) } as unknown as Db;
    const service = new AuthService(
      null as never,
      db,
      null as never,
      { getMember } as never,
      null as never,
      null as never,
    );
    await expect(
      service.getManagedGuilds(USER, [GUILD, OTHER, '111111111111111113']),
    ).resolves.toEqual({ guildIds: [GUILD] });
    // A server with no manager role set needs no Discord lookup.
    expect(getMember).toHaveBeenCalledTimes(2);
  });
});
