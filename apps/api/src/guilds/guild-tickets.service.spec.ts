import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Collections } from '../db';
import { TicketExtraButtonKind } from './dto';
import { GuildTicketsService } from './guild-tickets.service';

jest.mock('@app/discord-oauth', () => ({ DiscordOauthService: class {} }));

const GUILD = '111111111111111111';
const ROLE = '222222222222222222';
const CATEGORY = '333333333333333333';
const CHANNEL = '444444444444444444';
const ctx = { guildId: GUILD, applicationId: null };

type Doc = Record<string, any>;

const setup = (opts: { beta?: boolean; panels?: Doc[]; tickets?: Doc[] } = {}) => {
  const data: Record<string, Doc[]> = {
    [Collections.TICKET_PANELS]: opts.panels ?? [],
    [Collections.TICKETS]: opts.tickets ?? [],
    [Collections.TICKET_SETTINGS]: [],
  };
  const matches = (doc: Doc, filter: Doc) =>
    Object.entries(filter).every(([key, cond]) => {
      if (key === 'ticketTypes.id') return doc.ticketTypes.some((t: Doc) => t.id === cond);
      return cond instanceof ObjectId ? cond.equals(doc[key]) : doc[key] === cond;
    });
  const collection = (name: string) => {
    const docs = data[name];
    return {
      find: (filter: Doc) => ({
        toArray: () => Promise.resolve(docs.filter((d) => matches(d, filter))),
      }),
      findOne: (filter: Doc) => Promise.resolve(docs.find((d) => matches(d, filter)) ?? null),
      insertOne: (doc: Doc) => (docs.push(doc), Promise.resolve()),
      deleteOne: (filter: Doc) => {
        const i = docs.findIndex((d) => matches(d, filter));
        if (i >= 0) docs.splice(i, 1);
        return Promise.resolve({ deletedCount: i >= 0 ? 1 : 0 });
      },
      aggregate: () => ({
        toArray: () => {
          const groups = new Map<string, Doc>();
          for (const t of docs) {
            const g = groups.get(t.panelId) ?? { _id: t.panelId, total: 0, open: 0 };
            g.total += 1;
            if (t.status === 'open') g.open += 1;
            groups.set(t.panelId, g);
          }
          return Promise.resolve([...groups.values()]);
        },
      }),
      updateOne: (filter: Doc, update: Doc, options?: { upsert?: boolean }) => {
        let doc = docs.find((d) => matches(d, filter));
        if (!doc && options?.upsert) docs.push((doc = { ...filter }));
        if (!doc) return Promise.resolve();
        for (const [key, value] of Object.entries(update.$set ?? {})) {
          if (key.startsWith('ticketTypes.$.')) {
            const type = doc.ticketTypes.find((t: Doc) => t.id === filter['ticketTypes.id']);
            type[key.slice('ticketTypes.$.'.length)] = value;
          } else doc[key] = value;
        }
        for (const [key, value] of Object.entries(update.$push ?? {})) doc[key].push(value);
        for (const [key, cond] of Object.entries(update.$pull ?? {})) {
          doc[key] = doc[key].filter((t: Doc) => t.id !== (cond as Doc).id);
        }
        return Promise.resolve();
      },
    };
  };
  const discord = {
    checkChannel: jest.fn(),
    listRoles: jest.fn().mockResolvedValue([{ id: ROLE }]),
    listCategories: jest.fn().mockResolvedValue([{ id: CATEGORY, name: 'TICKETS' }]),
  };
  const beta = { isBeta: jest.fn().mockResolvedValue(opts.beta ?? true) };
  const service = new GuildTicketsService(
    { collection } as unknown as Db,
    discord as never,
    beta as never,
  );
  return { service, discord, panels: data[Collections.TICKET_PANELS] };
};

const create = async (service: GuildTicketsService, name = 'Applications') =>
  (await service.createPanel(ctx, { name })).panels.find((p) => p.name === name)!;

describe('GuildTicketsService', () => {
  it('only opens for beta servers', async () => {
    const { service } = setup({ beta: false });
    await expect(service.get(GUILD)).rejects.toThrow(ForbiddenException);
    await expect(service.createPanel(ctx, { name: 'x' })).rejects.toThrow(ForbiddenException);
  });

  it("creates a panel with the bot's defaults and refuses a taken name", async () => {
    const { service } = setup();
    const panel = await create(service);
    expect(panel).toMatchObject({
      displayMode: 'menu',
      button: { label: 'Create Ticket', emoji: '📩', style: 1 },
      embed: { title: 'Open a Ticket', color: 0x5865f2 },
      ticketCount: 0,
    });
    expect(panel.ticketTypes).toHaveLength(1);
    expect(panel.ticketTypes[0]).toMatchObject({
      label: 'General',
      namingConvention: 'ticket-{count}',
      pingRoleIds: [],
    });
    expect(panel.ticketTypes[0].id).toMatch(/^[\w-]{8}$/);
    await expect(service.createPanel(ctx, { name: 'Applications' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('counts open and total tickets per panel', async () => {
    const id = new ObjectId();
    const { service } = setup({
      panels: [{ _id: id, guildId: GUILD, name: 'P', ticketTypes: [], createdAt: new Date() }],
      tickets: [
        { guildId: GUILD, panelId: id.toHexString(), status: 'open' },
        { guildId: GUILD, panelId: id.toHexString(), status: 'closed' },
      ],
    });
    const [panel] = (await service.get(GUILD)).panels;
    expect(panel).toMatchObject({ ticketCount: 2, openTicketCount: 1, displayMode: 'menu' });
  });

  it('saves panel settings, checking new log channels and mapping extra buttons', async () => {
    const { service, discord, panels } = setup();
    const { id } = await create(service);
    await service.updatePanel(ctx, id, {
      logChannels: { ticketClose: CHANNEL },
      extraButtons: [
        { kind: TicketExtraButtonKind.LINK_ACCOUNT, label: 'Link account' },
        { kind: TicketExtraButtonKind.URL, label: 'Rules', url: 'https://example.com/rules' },
      ],
    });
    expect(discord.checkChannel).toHaveBeenCalledWith(GUILD, null, CHANNEL);
    expect(panels[0].logChannels).toEqual({
      buttonClick: null,
      statusChange: null,
      ticketClose: CHANNEL,
    });
    expect(panels[0].extraButtons).toEqual([
      expect.objectContaining({
        label: 'Link account',
        cmd: 'link-add',
        args: { token_field: 'required' },
        style: 2,
      }),
      expect.objectContaining({ label: 'Rules', url: 'https://example.com/rules' }),
    ]);
    expect(panels[0].extraButtons[1].cmd).toBeUndefined();
  });

  it('edits one ticket type in place and validates roles and categories', async () => {
    const { service, panels } = setup();
    const panel = await create(service);
    const typeId = panel.ticketTypes[0].id;

    const result = await service.updateType(ctx, panel.id, typeId, {
      pingRoleIds: [ROLE, ROLE],
      openCategoryId: CATEGORY,
      thMin: 14,
      allowClaim: false,
      questions: [{ label: 'Your tag?', required: true }],
    });
    expect(panels[0].ticketTypes[0]).toMatchObject({
      id: typeId,
      pingRoleIds: [ROLE],
      openCategoryId: CATEGORY,
      thMin: 14,
      allowClaim: null,
    });
    expect(result.panels[0].ticketTypes[0].questions).toEqual([
      { label: 'Your tag?', required: true },
    ]);

    await expect(
      service.updateType(ctx, panel.id, typeId, { addRoleIds: ['999999999999999999'] }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.updateType(ctx, panel.id, typeId, { sleepCategoryId: '999999999999999999' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('adds, reorders and deletes types, keeping their IDs', async () => {
    const { service } = setup();
    const panel = await create(service);
    const [first] = panel.ticketTypes;
    const added = (await service.addType(ctx, panel.id, { label: 'Support', emoji: '🛟' }))
      .panels[0].ticketTypes[1];

    const reordered = await service.reorderTypes(ctx, panel.id, [added.id, first.id]);
    expect(reordered.panels[0].ticketTypes.map((t) => t.id)).toEqual([added.id, first.id]);
    await expect(service.reorderTypes(ctx, panel.id, [added.id])).rejects.toThrow(
      BadRequestException,
    );

    const deleted = await service.deleteType(ctx, panel.id, first.id);
    expect(deleted.panels[0].ticketTypes.map((t) => t.id)).toEqual([added.id]);
  });

  it('saves replies with different names only', async () => {
    const { service } = setup();
    const saved = await service.saveReplies(ctx, [
      { name: 'Welcome', content: 'Hi {user_mention}' },
    ]);
    expect(saved.savedReplies).toEqual([{ name: 'Welcome', content: 'Hi {user_mention}' }]);
    await expect(
      service.saveReplies(ctx, [
        { name: 'A', content: '1' },
        { name: 'A', content: '2' },
      ]),
    ).rejects.toThrow(BadRequestException);
  });
});
