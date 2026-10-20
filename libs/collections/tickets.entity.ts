import { ObjectId } from 'mongodb';

/** One kind of ticket on a panel; its `id` is baked into posted buttons, so it never changes. */
export class TicketTypeConfig {
  id: string;
  label: string;
  emoji?: string | null;
  buttonStyle?: number | null;
  requireLinkedAccount: boolean;
  thMin?: number | null;
  minTrophies?: number | null;
  /** A league ID from 105000013 (Valkyrie 13) to 105000036 (Legend). */
  minLeagueTier?: string | null;
  questions?: { label: string; placeholder?: string; required: boolean }[];
  pingRoleIds: string[];
  viewOnlyRoleIds: string[];
  addRoleIds: string[];
  removeRoleIds: string[];
  openCategoryId?: string | null;
  sleepCategoryId?: string | null;
  namingConvention: string;
  createStaffThread: boolean;
  autoSleepHours?: number | null;
  allowClaim?: boolean | null;
}

export class TicketExtraButton {
  id: string;
  label: string;
  emoji?: string | null;
  cmd?: string;
  args?: Record<string, string>;
  style?: number;
  url?: string;
}

export class TicketPanelsEntity {
  _id: ObjectId;
  guildId: string;
  name: string;
  embed: {
    title?: string | null;
    description?: string | null;
    color?: number | null;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    footerText?: string | null;
  };
  displayMode: 'menu' | 'buttons';
  button: { label: string; emoji?: string | null; style: number };
  ticketTypes: TicketTypeConfig[];
  logChannels: {
    buttonClick?: string | null;
    statusChange?: string | null;
    ticketClose?: string | null;
  };
  extraButtons?: TicketExtraButton[];
  extraButtonsPlacement?: 'row' | 'col';
  createdAt: Date;
  updatedAt: Date;
}

export class TicketSettingsEntity {
  _id: ObjectId;
  guildId: string;
  savedReplies: { name: string; content: string }[];
  updatedAt: Date;
}

/** Tickets members opened; only counted here, the bot owns them. */
export class TicketsEntity {
  _id: ObjectId;
  guildId: string;
  panelId: string;
  status: 'open' | 'sleep' | 'closed';
}
