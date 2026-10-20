export type WebhookRef = { id: string; token: string };

export class WelcomeLogConfig {
  enabled: boolean;
  channelId: string;
  webhook: WebhookRef | null;
  buttons: string[];
  /** Always contains `{{user}}`, which becomes the new member's mention. */
  welcomeText: string;
  description: string;
  bannerImage: string | null;
  embedColor: number | null;
}

/** A `/setup buttons` message; the bot posts it as saved, so every field is always written. */
export class ButtonEmbedConfig {
  title: string;
  description: string;
  /** Empty for none. */
  image_url: string;
  thumbnail_url: string;
  /** Discord button style, 1 to 4. */
  button_style: number;
  embed_color: number | null;
  /** Link button only. */
  token_field?: 'required' | 'optional' | 'hidden';
}

export class SettingsEntity {
  guildId: string;
  /** Clans that can have logs; unset means the free 2. */
  clanLimit?: number;
  /** Embed colour as an RGB integer; null or unset uses the default. */
  color?: number | null;
  /** Webhooks per channel; the bot clamps it to 3 to 8. */
  webhookLimit?: number;
  /** Role IDs; older records hold a single ID. */
  managerRole?: string[] | string;
  rosterManagerRole?: string[] | string;
  flagsManagerRole?: string[] | string;
  linksManagerRole?: string[] | string;
  hasFlagAlertLog?: boolean;
  rosterChangeLog?: { channelId: string; webhook: WebhookRef | null };
  /** Where the bot posts maintenance breaks; it sends as itself, not a webhook. */
  eventsChannel?: string;
  welcomeLog?: WelcomeLogConfig;
  /** Also sets the link button on welcome messages. */
  linkEmbeds?: ButtonEmbedConfig;
  refreshEmbeds?: ButtonEmbedConfig;
  myRostersEmbeds?: ButtonEmbedConfig;
}
