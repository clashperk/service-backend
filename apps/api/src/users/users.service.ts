import { ClashClientService } from '@app/clash-client';
import { fixTag } from '@app/helpers';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { UserSettingsDto } from './dto/user-settings.dto';

/** The zone's name, e.g. `India Standard Time` or `GMT+05:30`; null for an unknown zone. */
const timezoneName = (id: string, style: 'long' | 'longOffset') => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: id, timeZoneName: style })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')!.value;
  } catch {
    return null;
  }
};

const MAX_SAVED_CLANS = 50;

/** The bot's per-user settings in `Users`: default clan, saved clans and timezone. */
@Injectable()
export class UsersService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly clashClientService: ClashClientService,
  ) {}

  async getSettings(userId: string): Promise<UserSettingsDto> {
    const user = await this.users.findOne({ userId });
    return {
      clan: user?.clan ? { tag: user.clan.tag, name: user.clan.name ?? null } : null,
      savedClans: (user?.savedClans ?? []).map((clan) => ({ tag: clan.tag, name: clan.name })),
      timezone: user?.timezone
        ? { id: user.timezone.id, name: user.timezone.name, location: user.timezone.location }
        : null,
    };
  }

  async setDefaultClan(userId: string, clanTag: string) {
    const clan = await this.findClan(clanTag);
    await this.save(userId, { clan });
    return this.getSettings(userId);
  }

  async clearDefaultClan(userId: string) {
    await this.users.updateOne({ userId }, { $unset: { clan: '' } });
    return this.getSettings(userId);
  }

  /** Saving a clan again refreshes its name and keeps its place. */
  async saveClan(userId: string, clanTag: string) {
    const clan = await this.findClan(clanTag);
    const saved = (await this.users.findOne({ userId }))?.savedClans ?? [];
    const index = saved.findIndex((entry) => entry.tag === clan.tag);
    if (index < 0 && saved.length >= MAX_SAVED_CLANS) {
      throw new BadRequestException(`You can save up to ${MAX_SAVED_CLANS} clans.`);
    }
    const next = index < 0 ? [...saved, clan] : saved.with(index, clan);
    await this.save(userId, { savedClans: next });
    return this.getSettings(userId);
  }

  async unsaveClan(userId: string, clanTag: string) {
    await this.users.updateOne({ userId }, { $pull: { savedClans: { tag: fixTag(clanTag) } } });
    return this.getSettings(userId);
  }

  /** Stored as `/timezone` does; the bot reads the offset again from the ID when it's used. */
  async setTimezone(userId: string, id: string) {
    const offsetName = timezoneName(id, 'longOffset');
    if (!offsetName) throw new BadRequestException('Pick a timezone from the list.');
    const [, sign, hours, minutes] = /GMT(?:([+-])(\d{2}):(\d{2}))?/.exec(offsetName)!;
    const offset = sign ? (sign === '-' ? -1 : 1) * (+hours * 3600 + +minutes * 60) : 0;
    await this.save(userId, {
      timezone: {
        id,
        name: timezoneName(id, 'long')!,
        offset,
        location: id.split('/').pop()!.replace(/_/g, ' '),
      },
    });
    return this.getSettings(userId);
  }

  async clearTimezone(userId: string) {
    await this.users.updateOne({ userId }, { $unset: { timezone: '' } });
    return this.getSettings(userId);
  }

  private async findClan(clanTag: string) {
    const clan = await this.clashClientService.getClan(fixTag(clanTag));
    if (!clan) throw new NotFoundException('No clan has that tag.');
    return { tag: clan.tag, name: clan.name };
  }

  private save(userId: string, set: Record<string, unknown>) {
    return this.users.updateOne(
      { userId },
      { $set: set, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
  }

  private get users() {
    return this.db.collection(Collections.USERS);
  }
}
