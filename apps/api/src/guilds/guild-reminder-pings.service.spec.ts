import { BadRequestException } from '@nestjs/common';
import { Db } from 'mongodb';
import { GuildReminderPingsService } from './guild-reminder-pings.service';

vi.mock('@app/discord-rest', () => ({ DiscordRestService: class {} }));

const GUILD = '111111111111111111';
const ROLE = (n: number) => `22222222222222222${n}`;
const USER = (n: number) => `33333333333333333${n}`;

type Doc = Record<string, unknown>;

const setup = (settings?: Doc) => {
  const docs: Doc[] = settings ? [{ guildId: GUILD, ...settings }] : [];
  const collection = {
    findOne: (filter: Doc) =>
      Promise.resolve(docs.find((d) => d.guildId === filter.guildId) ?? null),
    updateOne: (filter: Doc, update: Record<string, Doc>) => {
      let doc = docs.find((d) => d.guildId === filter.guildId);
      if (!doc) docs.push((doc = { ...filter }));
      Object.assign(doc, update.$set ?? {});
      for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
      return Promise.resolve();
    },
  };
  const holders: Record<string, string[]> = { [ROLE(1)]: [USER(1), USER(2)], [ROLE(2)]: [] };
  const discord = {
    listRoles: vi.fn().mockResolvedValue([1, 2].map((n) => ({ id: ROLE(n) }))),
    roleMembers: vi.fn((_g: string, _a: string | null, ids: string[]) =>
      Promise.resolve(new Map(ids.map((id) => [id, holders[id]]))),
    ),
  };
  const service = new GuildReminderPingsService(
    { collection: () => collection } as unknown as Db,
    discord as never,
  );
  return { service, docs, discord };
};

describe('GuildReminderPingsService', () => {
  it('reads opt-in with no roles when nothing is set', async () => {
    await expect(setup().service.get(GUILD)).resolves.toEqual({
      mode: 'optIn',
      clanWarsRole: null,
      capitalRaidsRole: null,
      clanGamesRole: null,
    });
  });

  it("saves roles with their members, in the bot's format", async () => {
    const { service, docs, discord } = setup();
    const result = await service.save({
      guildId: GUILD,
      applicationId: null,
      body: {
        mode: 'optOut',
        clanWarsRole: ROLE(1),
        capitalRaidsRole: null,
        clanGamesRole: ROLE(1),
      },
    });
    expect(discord.roleMembers).toHaveBeenCalledWith(GUILD, null, [ROLE(1)]);
    expect(docs[0].reminderExclusion).toEqual({
      type: 'optOut',
      wars: ROLE(1),
      warsExclusionUserIds: [USER(1), USER(2)],
      games: ROLE(1),
      gamesExclusionUserIds: [USER(1), USER(2)],
    });
    expect(result).toEqual({
      mode: 'optOut',
      clanWarsRole: ROLE(1),
      capitalRaidsRole: null,
      clanGamesRole: ROLE(1),
    });
  });

  it('drops the setting when no role is left, without listing members', async () => {
    const { service, docs, discord } = setup({
      reminderExclusion: { type: 'optIn', wars: ROLE(1) },
    });
    await service.save({
      guildId: GUILD,
      applicationId: null,
      body: { mode: 'optIn', clanWarsRole: null, capitalRaidsRole: null, clanGamesRole: null },
    });
    expect(docs[0].reminderExclusion).toBeUndefined();
    expect(discord.roleMembers).not.toHaveBeenCalled();
  });

  it('rejects roles from another server', async () => {
    const { service } = setup();
    await expect(
      service.save({
        guildId: GUILD,
        applicationId: null,
        body: { mode: 'optIn', clanWarsRole: ROLE(9), capitalRaidsRole: null, clanGamesRole: null },
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
