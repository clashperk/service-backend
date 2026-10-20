import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { ServerConfigDto, ServerConfigInput, WEBHOOK_LIMIT } from './dto';

/** What `/config` shows: embed colour, webhook limit and subscription status. */
@Injectable()
export class GuildConfigService {
  constructor(@Inject(MONGODB_TOKEN) private readonly db: Db) {}

  async get(guildId: string): Promise<ServerConfigDto> {
    const [settings, patron] = await Promise.all([
      this.settings.findOne({ guildId }),
      this.db
        .collection(Collections.PATRONS)
        .findOne({ 'active': true, 'guilds.id': guildId }, { projection: { note: 1 } }),
    ]);
    const limit = settings?.webhookLimit ?? WEBHOOK_LIMIT.max;
    return {
      color: settings?.color ?? null,
      // The bot clamps whatever is stored, so show what it uses.
      webhookLimit: Math.max(WEBHOOK_LIMIT.min, Math.min(WEBHOOK_LIMIT.max, limit)),
      // Patreon is the only provider so far.
      subscription: { active: !!patron, tier: patron?.note ?? null },
    };
  }

  async save(guildId: string, body: ServerConfigInput): Promise<ServerConfigDto> {
    const set: Record<string, number> = {};
    const unset: Record<string, true> = {};
    if (body.color === null) unset.color = true;
    else if (body.color !== undefined) set.color = body.color;
    if (body.webhookLimit !== undefined) set.webhookLimit = body.webhookLimit;

    if (Object.keys(set).length || Object.keys(unset).length) {
      await this.settings.updateOne(
        { guildId },
        {
          ...(Object.keys(set).length ? { $set: set } : {}),
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
        { upsert: true },
      );
    }
    return this.get(guildId);
  }

  private get settings() {
    return this.db.collection(Collections.SETTINGS);
  }
}
