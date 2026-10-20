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

export class SettingsEntity {
  guildId: string;
  hasFlagAlertLog?: boolean;
  rosterChangeLog?: { channelId: string; webhook: WebhookRef | null };
  /** Where the bot posts maintenance breaks; it sends as itself, not a webhook. */
  eventsChannel?: string;
  welcomeLog?: WelcomeLogConfig;
}
