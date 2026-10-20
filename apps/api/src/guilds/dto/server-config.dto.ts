import { IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export const WEBHOOK_LIMIT = { min: 3, max: 8 };

/** Only the fields sent change. */
export class ServerConfigInput {
  /** RGB integer for the bot's embeds; null goes back to the default. */
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(0xffffff)
  color?: number | null;

  /** Most webhooks the bot creates in one channel before it shares them between logs. */
  @IsOptional()
  @IsInt()
  @Min(WEBHOOK_LIMIT.min)
  @Max(WEBHOOK_LIMIT.max)
  webhookLimit?: number;
}

/** Whether the server has a paid plan, from any payment provider. */
export class SubscriptionDto {
  active: boolean;
  /** A special tier such as `lifetime` or `gifted`; null for a regular plan. */
  tier: string | null;
}

export class ServerConfigDto {
  color: number | null;
  webhookLimit: number;
  subscription: SubscriptionDto;
}
