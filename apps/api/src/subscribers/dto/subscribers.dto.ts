import { EnumString } from '@app/decorators';

export enum SubscriptionProvider {
  PATREON = 'patreon',
}

export enum BillingCadence {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class SubscriberServerDto {
  id: string;
  name: string;
  /** Clans this subscription lets the server have logs for. */
  clanLimit: number;
}

/** A paid subscription, without contact details. */
export class SubscriberDto {
  id: string;
  @EnumString(SubscriptionProvider, 'SubscriptionProvider')
  provider: SubscriptionProvider;
  name: string;
  /** The Discord account that redeemed it; null until someone does. */
  discordUserId: string | null;
  discordUsername: string | null;
  /** Bronze, silver or gold; null for special tiers or an unknown reward. */
  plan: string | null;
  /** A special tier such as `lifetime` or `gifted`. */
  tier: string | null;
  active: boolean;
  /** The provider's own status, e.g. `active_patron` or `declined_patron`. */
  status: string | null;
  /** What each charge bills, for a month or a year. */
  billedCents: number;
  @EnumString(BillingCadence, 'BillingCadence')
  cadence: BillingCadence;
  /** The charge spread per month, estimated for yearly plans. */
  monthlyCents: number;
  lifetimeCents: number;
  customBot: boolean;
  servers: SubscriberServerDto[];
  lastChargeDate: Date | null;
  createdAt: Date;
}

export class SubscribersDto {
  subscribers: SubscriberDto[];
}
