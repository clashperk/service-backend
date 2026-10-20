import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { BillingCadence, SubscribersDto, SubscriptionProvider } from './dto/subscribers.dto';

// The bot's Patreon reward IDs, with each plan's monthly price in cents.
const PLANS: Record<string, { plan: string; monthlyCents: number }> = {
  '3705318': { plan: 'bronze', monthlyCents: 300 },
  '4742718': { plan: 'silver', monthlyCents: 500 },
  '5352215': { plan: 'gold', monthlyCents: 1000 },
  '21789215': { plan: 'gold', monthlyCents: 800 },
};

/**
 * Patreon stores what each charge bills, a month or a year at a time, without saying which.
 * A charge over twice the plan's monthly price is a yearly one.
 */
const billing = (rewardId: string, billedCents: number) => {
  const price = PLANS[rewardId]?.monthlyCents;
  const yearly = !!price && billedCents > price * 2;
  return {
    cadence: yearly ? BillingCadence.YEARLY : BillingCadence.MONTHLY,
    monthlyCents: yearly ? Math.round(billedCents / 12) : billedCents,
  };
};

@Injectable()
export class SubscribersService {
  constructor(@Inject(MONGODB_TOKEN) private readonly db: Db) {}

  /** Every subscription, active first, then newest. */
  async list(): Promise<SubscribersDto> {
    const records = await this.db
      .collection(Collections.PATRONS)
      .find({}, { projection: { email: 0 }, sort: { active: -1, createdAt: -1 } })
      .toArray();
    return {
      subscribers: records.map((record) => ({
        id: record.id,
        provider: SubscriptionProvider.PATREON,
        name: record.name,
        discordUserId: record.userId ?? null,
        discordUsername: record.username ?? null,
        plan: PLANS[record.rewardId]?.plan ?? null,
        tier: record.note ?? null,
        active: record.active,
        status: record.status ?? null,
        billedCents: record.entitledAmount ?? 0,
        ...billing(record.rewardId, record.entitledAmount ?? 0),
        lifetimeCents: record.lifetimeSupport ?? 0,
        customBot: !!record.applicationId,
        servers: (record.guilds ?? []).map((guild) => ({
          id: guild.id,
          name: guild.name,
          clanLimit: guild.limit,
        })),
        lastChargeDate: record.lastChargeDate ?? null,
        createdAt: record.createdAt,
      })),
    };
  }
}
