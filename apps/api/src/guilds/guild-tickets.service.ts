import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Db, ObjectId, WithId } from 'mongodb';
import { BetaService } from '../beta/beta.service';
import {
  Collections,
  MONGODB_TOKEN,
  TicketExtraButton,
  TicketPanelsEntity,
  TicketTypeConfig,
} from '../db';
import {
  CreateTicketPanelInput,
  CreateTicketTypeInput,
  TicketDisplayMode,
  TicketExtraButtonKind,
  TicketPanelDto,
  TicketPanelInput,
  TicketSavedReplyInput,
  TicketsDto,
  TicketTypeDto,
  TicketTypeInput,
} from './dto';
import { GuildDiscordService } from './guild-discord.service';

type Ctx = { guildId: string; applicationId: string | null };

const MAX_TYPES = 25;
// The defaults `/ticket setup` gives a new panel and a new type.
const DEFAULT_NAMING = 'ticket-{count}';
const LINK_ACCOUNT = { cmd: 'link-add', args: { token_field: 'required' } };
const ROLE_FIELDS = ['pingRoleIds', 'viewOnlyRoleIds', 'addRoleIds', 'removeRoleIds'] as const;

/** Same shape as the bot's `nanoid(8)`; type IDs are baked into posted buttons. */
const newId = () => randomBytes(6).toString('base64url');

const newType = (label: string, emoji: string | null): TicketTypeConfig => ({
  id: newId(),
  label,
  emoji,
  requireLinkedAccount: false,
  pingRoleIds: [],
  viewOnlyRoleIds: [],
  addRoleIds: [],
  removeRoleIds: [],
  namingConvention: DEFAULT_NAMING,
  createStaffThread: false,
});

/**
 * Ticket panels in `/ticket setup`'s format. The bot reads them fresh on every click, so changes
 * apply at once; a posted panel's look only changes when it's posted again.
 */
@Injectable()
export class GuildTicketsService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discord: GuildDiscordService,
    private readonly beta: BetaService,
  ) {}

  async get(guildId: string): Promise<TicketsDto> {
    await this.assertBeta(guildId);
    const [panels, counts, settings] = await Promise.all([
      this.panels.find({ guildId }, { sort: { createdAt: 1 } }).toArray(),
      this.tickets
        .aggregate<{ _id: string; total: number; open: number }>([
          { $match: { guildId } },
          {
            $group: {
              _id: '$panelId',
              total: { $sum: 1 },
              open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
            },
          },
        ])
        .toArray(),
      this.settings.findOne({ guildId }),
    ]);
    const byPanel = new Map(counts.map((count) => [count._id, count]));
    return {
      panels: panels.map((panel) => this.toPanelDto(panel, byPanel.get(panel._id.toHexString()))),
      savedReplies: (settings?.savedReplies ?? []).map(({ name, content }) => ({ name, content })),
    };
  }

  async createPanel(ctx: Ctx, body: CreateTicketPanelInput) {
    await this.assertBeta(ctx.guildId);
    await this.assertNameFree(ctx.guildId, body.name);
    const now = new Date();
    await this.panels.insertOne({
      _id: new ObjectId(),
      guildId: ctx.guildId,
      name: body.name,
      embed: {
        title: 'Open a Ticket',
        description: 'Click a button below to open a support ticket.',
        color: 0x5865f2,
      },
      displayMode: TicketDisplayMode.MENU,
      button: { label: 'Create Ticket', emoji: '📩', style: 1 },
      ticketTypes: [newType('General', null)],
      logChannels: {},
      createdAt: now,
      updatedAt: now,
    });
    return this.get(ctx.guildId);
  }

  async updatePanel(ctx: Ctx, panelId: string, body: TicketPanelInput) {
    const panel = await this.findPanel(ctx.guildId, panelId);
    const set: Record<string, unknown> = {};

    if (body.name !== undefined && body.name !== panel.name) {
      await this.assertNameFree(ctx.guildId, body.name);
      set.name = body.name;
    }
    if (body.embed) {
      const { title, description, color, imageUrl, thumbnailUrl, footerText } = body.embed;
      set.embed = {
        title: title ?? null,
        description: description ?? null,
        color: color ?? null,
        imageUrl: imageUrl ?? null,
        thumbnailUrl: thumbnailUrl ?? null,
        footerText: footerText ?? null,
      };
    }
    if (body.displayMode) set.displayMode = body.displayMode;
    if (body.button) {
      set.button = {
        label: body.button.label,
        emoji: body.button.emoji ?? null,
        style: body.button.style,
      };
    }
    if (body.logChannels) {
      const logChannels = {
        buttonClick: body.logChannels.buttonClick ?? null,
        statusChange: body.logChannels.statusChange ?? null,
        ticketClose: body.logChannels.ticketClose ?? null,
      };
      const changed = Object.entries(logChannels)
        .filter(([key, id]) => id && id !== panel.logChannels?.[key as keyof typeof logChannels])
        .map(([, id]) => id as string);
      for (const channelId of new Set(changed)) {
        await this.discord.checkChannel(ctx.guildId, ctx.applicationId, channelId);
      }
      set.logChannels = logChannels;
    }
    if (body.extraButtons) {
      set.extraButtons = body.extraButtons.map(
        (button): TicketExtraButton => ({
          id: newId(),
          label: button.label,
          emoji: button.emoji ?? null,
          ...(button.kind === TicketExtraButtonKind.URL
            ? { url: button.url }
            : { ...LINK_ACCOUNT, style: button.style ?? 2 }),
        }),
      );
    }
    if (body.extraButtonsPlacement) set.extraButtonsPlacement = body.extraButtonsPlacement;

    if (Object.keys(set).length) {
      await this.panels.updateOne({ _id: panel._id }, { $set: { ...set, updatedAt: new Date() } });
    }
    return this.get(ctx.guildId);
  }

  /** Tickets already opened from the panel stay; its posted message stops opening new ones. */
  async deletePanel(ctx: Ctx, panelId: string) {
    const panel = await this.findPanel(ctx.guildId, panelId);
    await this.panels.deleteOne({ _id: panel._id });
    return this.get(ctx.guildId);
  }

  async addType(ctx: Ctx, panelId: string, body: CreateTicketTypeInput) {
    const panel = await this.findPanel(ctx.guildId, panelId);
    if (panel.ticketTypes.length >= MAX_TYPES) {
      throw new BadRequestException(`A panel can have up to ${MAX_TYPES} ticket types.`);
    }
    await this.panels.updateOne(
      { _id: panel._id },
      {
        $push: { ticketTypes: newType(body.label, body.emoji ?? null) },
        $set: { updatedAt: new Date() },
      },
    );
    return this.get(ctx.guildId);
  }

  async updateType(ctx: Ctx, panelId: string, typeId: string, body: TicketTypeInput) {
    const panel = await this.findPanel(ctx.guildId, panelId);
    const type = panel.ticketTypes.find((t) => t.id === typeId);
    if (!type) throw new NotFoundException('That ticket type no longer exists.');

    const newRoles = ROLE_FIELDS.flatMap((field) =>
      (body[field] ?? []).filter((id) => !type[field].includes(id)),
    );
    if (newRoles.length) {
      const roles = await this.discord.listRoles(ctx);
      const known = new Set(roles.map((role) => role.id));
      if (newRoles.some((id) => !known.has(id))) {
        throw new BadRequestException('Pick roles in this server.');
      }
    }
    const newCategories = [body.openCategoryId, body.sleepCategoryId].filter(
      (id): id is string => !!id && id !== type.openCategoryId && id !== type.sleepCategoryId,
    );
    if (newCategories.length) {
      const categories = await this.discord.listCategories(ctx);
      if (newCategories.some((id) => !categories.some((category) => category.id === id))) {
        throw new BadRequestException('Pick categories in this server.');
      }
    }

    const set: Record<string, unknown> = {};
    const assign = <K extends keyof TicketTypeInput>(key: K, value = body[key]) => {
      if (value !== undefined) set[`ticketTypes.$.${key}`] = value;
    };
    assign('label');
    assign('emoji');
    assign('buttonStyle');
    assign('requireLinkedAccount');
    assign('thMin');
    assign('minTrophies');
    assign('minLeagueTier');
    for (const field of ROLE_FIELDS) assign(field, body[field] && [...new Set(body[field])]);
    assign('openCategoryId');
    assign('sleepCategoryId');
    assign('namingConvention');
    assign('createStaffThread');
    assign('autoSleepHours');
    // The bot keeps claiming as true or unset.
    if (body.allowClaim !== undefined) set['ticketTypes.$.allowClaim'] = body.allowClaim || null;
    if (body.questions) {
      set['ticketTypes.$.questions'] = body.questions.map(({ label, required }) => ({
        label,
        required,
      }));
    }

    if (Object.keys(set).length) {
      await this.panels.updateOne(
        { '_id': panel._id, 'ticketTypes.id': typeId },
        { $set: { ...set, updatedAt: new Date() } },
      );
    }
    return this.get(ctx.guildId);
  }

  /** Tickets of a deleted type stay open; the bot just can't load its settings any more. */
  async deleteType(ctx: Ctx, panelId: string, typeId: string) {
    const panel = await this.findPanel(ctx.guildId, panelId);
    if (!panel.ticketTypes.some((t) => t.id === typeId)) {
      throw new NotFoundException('That ticket type no longer exists.');
    }
    await this.panels.updateOne(
      { _id: panel._id },
      { $pull: { ticketTypes: { id: typeId } }, $set: { updatedAt: new Date() } },
    );
    return this.get(ctx.guildId);
  }

  async reorderTypes(ctx: Ctx, panelId: string, typeIds: string[]) {
    const panel = await this.findPanel(ctx.guildId, panelId);
    const byId = new Map(panel.ticketTypes.map((t) => [t.id, t]));
    if (typeIds.length !== byId.size || new Set(typeIds).size !== byId.size) {
      throw new BadRequestException('Send every ticket type once.');
    }
    const ordered = typeIds.map((id) => byId.get(id));
    if (ordered.some((t) => !t)) throw new BadRequestException('Send every ticket type once.');
    await this.panels.updateOne(
      { _id: panel._id },
      { $set: { ticketTypes: ordered as TicketTypeConfig[], updatedAt: new Date() } },
    );
    return this.get(ctx.guildId);
  }

  /** Shared by every panel in the server; staff send them from inside a ticket. */
  async saveReplies(ctx: Ctx, replies: TicketSavedReplyInput[]) {
    await this.assertBeta(ctx.guildId);
    const names = replies.map((reply) => reply.name);
    if (new Set(names).size !== names.length) {
      throw new BadRequestException('Give each saved reply a different name.');
    }
    await this.settings.updateOne(
      { guildId: ctx.guildId },
      { $set: { savedReplies: replies, updatedAt: new Date() } },
      { upsert: true },
    );
    return this.get(ctx.guildId);
  }

  private async assertBeta(guildId: string) {
    if (!(await this.beta.isBeta(guildId))) {
      throw new ForbiddenException("Tickets are in beta and aren't open for this server yet.");
    }
  }

  // `/ticket post` and `/ticket setup` find panels by exact name.
  private async assertNameFree(guildId: string, name: string) {
    if (await this.panels.findOne({ guildId, name }, { projection: { _id: 1 } })) {
      throw new ConflictException('A panel already has that name.');
    }
  }

  private async findPanel(guildId: string, panelId: string) {
    await this.assertBeta(guildId);
    const panel = ObjectId.isValid(panelId)
      ? await this.panels.findOne({ _id: new ObjectId(panelId), guildId })
      : null;
    if (!panel) throw new NotFoundException('That panel no longer exists.');
    return panel;
  }

  private toPanelDto(
    panel: WithId<TicketPanelsEntity>,
    counts: { total: number; open: number } | undefined,
  ): TicketPanelDto {
    const embed = panel.embed ?? {};
    return {
      id: panel._id.toHexString(),
      name: panel.name,
      embed: {
        title: embed.title || null,
        description: embed.description || null,
        color: embed.color || null,
        imageUrl: embed.imageUrl || null,
        thumbnailUrl: embed.thumbnailUrl || null,
        footerText: embed.footerText || null,
      },
      displayMode:
        panel.displayMode === 'buttons' ? TicketDisplayMode.BUTTONS : TicketDisplayMode.MENU,
      button: {
        label: panel.button?.label ?? 'Create Ticket',
        emoji: panel.button?.emoji || null,
        style: panel.button?.style ?? 1,
      },
      ticketTypes: (panel.ticketTypes ?? []).map((type) => this.toTypeDto(type)),
      logChannels: {
        buttonClick: panel.logChannels?.buttonClick || null,
        statusChange: panel.logChannels?.statusChange || null,
        ticketClose: panel.logChannels?.ticketClose || null,
      },
      extraButtons: (panel.extraButtons ?? []).map((button) => ({
        id: button.id,
        kind: button.url ? TicketExtraButtonKind.URL : TicketExtraButtonKind.LINK_ACCOUNT,
        label: button.label,
        emoji: button.emoji || null,
        style: button.style ?? 2,
        url: button.url ?? null,
      })),
      extraButtonsPlacement: panel.extraButtonsPlacement ?? 'row',
      ticketCount: counts?.total ?? 0,
      openTicketCount: counts?.open ?? 0,
      updatedAt: panel.updatedAt,
    };
  }

  private toTypeDto(type: TicketTypeConfig): TicketTypeDto {
    return {
      id: type.id,
      label: type.label,
      emoji: type.emoji || null,
      buttonStyle: type.buttonStyle || 1,
      requireLinkedAccount: !!type.requireLinkedAccount,
      thMin: type.thMin || null,
      minTrophies: type.minTrophies || null,
      minLeagueTier: type.minLeagueTier || null,
      questions: (type.questions ?? []).map(({ label, required }) => ({ label, required })),
      pingRoleIds: type.pingRoleIds ?? [],
      viewOnlyRoleIds: type.viewOnlyRoleIds ?? [],
      addRoleIds: type.addRoleIds ?? [],
      removeRoleIds: type.removeRoleIds ?? [],
      openCategoryId: type.openCategoryId || null,
      sleepCategoryId: type.sleepCategoryId || null,
      namingConvention: type.namingConvention || DEFAULT_NAMING,
      createStaffThread: !!type.createStaffThread,
      autoSleepHours: type.autoSleepHours || null,
      allowClaim: !!type.allowClaim,
    };
  }

  private get panels() {
    return this.db.collection(Collections.TICKET_PANELS);
  }

  private get tickets() {
    return this.db.collection(Collections.TICKETS);
  }

  private get settings() {
    return this.db.collection(Collections.TICKET_SETTINGS);
  }
}
