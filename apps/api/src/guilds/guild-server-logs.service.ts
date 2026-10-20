import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import {
  FlagAlertLogInput,
  MaintenanceLogInput,
  ServerLogChannelInput,
  ServerLogsDto,
  WelcomeLogInput,
} from './dto';
import { GuildDiscordService, Webhook } from './guild-discord.service';

type Input<T> = { guildId: string; applicationId: string | null; body: T };

/**
 * Server-wide logs as `/setup server-logs` stores them: flag alerts in their own collection, the
 * rest in `Settings`. The bot reloads both when they change.
 */
@Injectable()
export class GuildServerLogsService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discord: GuildDiscordService,
  ) {}

  async get(guildId: string, applicationId: string | null): Promise<ServerLogsDto> {
    const [settings, flagAlert] = await Promise.all([
      this.settings.findOne({ guildId }),
      this.flagAlertLogs.findOne({ guildId }),
    ]);
    const roster = settings?.rosterChangeLog;
    const welcome = settings?.welcomeLog;
    const channels = await this.discord.channelStatuses(
      guildId,
      applicationId,
      [flagAlert?.channelId, roster?.channelId, settings?.eventsChannel, welcome?.channelId].filter(
        (id): id is string => !!id,
      ),
    );
    const channel = (channelId: string) => ({
      channelId,
      channelName: channels.get(channelId)?.name ?? null,
    });

    return {
      flagAlert: flagAlert
        ? {
            ...channel(flagAlert.channelId),
            roleId: flagAlert.roleId ?? null,
            useAutoRole: flagAlert.useAutoRole ?? false,
          }
        : null,
      rosterChangelog: roster ? channel(roster.channelId) : null,
      maintenance: settings?.eventsChannel ? channel(settings.eventsChannel) : null,
      welcome: welcome
        ? {
            ...channel(welcome.channelId),
            enabled: welcome.enabled,
            welcomeText: welcome.welcomeText,
            description: welcome.description,
            bannerImage: welcome.bannerImage || null,
            embedColor: welcome.embedColor ?? null,
          }
        : null,
    };
  }

  async saveFlagAlert({ guildId, applicationId, body }: Input<FlagAlertLogInput>) {
    const existing = await this.flagAlertLogs.findOne({ guildId });
    const sameChannel = existing?.channelId === body.channelId;
    if (!sameChannel) await this.discord.checkChannel(guildId, applicationId, body.channelId);
    if (body.roleId && body.roleId !== existing?.roleId) {
      await this.discord.checkRole(guildId, applicationId, body.roleId);
    }
    // The bot creates a webhook when there's none, so a new channel only needs a known one.
    const webhook =
      sameChannel && !body.webhook
        ? existing?.webhook
        : await this.discord.resolveWebhook(guildId, applicationId, body.channelId, body.webhook);

    const now = new Date();
    await this.flagAlertLogs.updateOne(
      { guildId },
      {
        $set: {
          channelId: body.channelId,
          roleId: body.roleId ?? null,
          useAutoRole: body.useAutoRole ?? false,
          updatedAt: now,
          ...(webhook ? { webhook } : {}),
        },
        ...(webhook ? {} : { $unset: { webhook: true as const } }),
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    await this.settings.updateOne(
      { guildId },
      { $set: { hasFlagAlertLog: true } },
      { upsert: true },
    );
    return this.get(guildId, applicationId);
  }

  async deleteFlagAlert(guildId: string, applicationId: string | null) {
    const { deletedCount } = await this.flagAlertLogs.deleteOne({ guildId });
    if (!deletedCount) throw new NotFoundException('The flag alert log is not set up.');
    await this.settings.updateOne({ guildId }, { $unset: { hasFlagAlertLog: true } });
    return this.get(guildId, applicationId);
  }

  async saveRosterChangelog({ guildId, applicationId, body }: Input<ServerLogChannelInput>) {
    const settings = await this.settings.findOne({ guildId });
    const webhook = await this.webhookFor(guildId, applicationId, body, settings?.rosterChangeLog);
    await this.settings.updateOne(
      { guildId },
      { $set: { rosterChangeLog: { channelId: body.channelId, webhook } } },
      { upsert: true },
    );
    return this.get(guildId, applicationId);
  }

  async saveMaintenance({ guildId, applicationId, body }: Input<MaintenanceLogInput>) {
    await this.discord.checkChannel(guildId, applicationId, body.channelId);
    await this.settings.updateOne(
      { guildId },
      { $set: { eventsChannel: body.channelId } },
      { upsert: true },
    );
    return this.get(guildId, applicationId);
  }

  async saveWelcome({ guildId, applicationId, body }: Input<WelcomeLogInput>) {
    const settings = await this.settings.findOne({ guildId });
    const existing = settings?.welcomeLog;
    const webhook = await this.webhookFor(guildId, applicationId, body, existing);
    await this.settings.updateOne(
      { guildId },
      {
        $set: {
          welcomeLog: {
            enabled: true,
            channelId: body.channelId,
            webhook,
            buttons: existing?.buttons ?? ['link-button'],
            welcomeText: body.welcomeText,
            description: body.description,
            bannerImage: body.bannerImage ?? null,
            embedColor: body.embedColor ?? null,
          },
        },
      },
      { upsert: true },
    );
    return this.get(guildId, applicationId);
  }

  /** Turning a log off clears it, except the welcome log, which keeps its message for later. */
  async delete(
    guildId: string,
    applicationId: string | null,
    key: 'rosterChangeLog' | 'eventsChannel' | 'welcomeLog',
  ) {
    const settings = await this.settings.findOne({ guildId });
    if (!settings?.[key] || (key === 'welcomeLog' && !settings.welcomeLog?.enabled)) {
      throw new NotFoundException('That log is not set up.');
    }
    await this.settings.updateOne(
      { guildId },
      key === 'welcomeLog'
        ? { $set: { 'welcomeLog.enabled': false } }
        : { $unset: { [key]: true as const } },
    );
    return this.get(guildId, applicationId);
  }

  private async webhookFor(
    guildId: string,
    applicationId: string | null,
    body: ServerLogChannelInput,
    existing: { channelId: string; webhook: Webhook | null } | undefined,
  ) {
    if (existing?.channelId === body.channelId && !body.webhook) return existing.webhook ?? null;
    await this.discord.checkChannel(guildId, applicationId, body.channelId);
    return this.discord.resolveWebhook(guildId, applicationId, body.channelId, body.webhook);
  }

  private get settings() {
    return this.db.collection(Collections.SETTINGS);
  }

  private get flagAlertLogs() {
    return this.db.collection(Collections.FLAG_ALERT_LOGS);
  }
}
