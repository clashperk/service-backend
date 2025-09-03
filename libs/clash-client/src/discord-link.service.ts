import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { SNOWFLAKE_REGEX, TAG_REGEX } from '../../constants';
import { ClashClient } from './client';

@Injectable()
export class DiscordLinkService {
  private logger = new Logger(DiscordLinkService.name);

  private bearerToken: string;
  private username: string;
  private password: string;
  private baseUrl = 'https://cocdiscord.link';

  constructor(
    configService: ConfigService,
    private clashClient: ClashClient,
  ) {
    this.username = configService.getOrThrow('DISCORD_LINK_USERNAME');
    this.password = configService.getOrThrow('DISCORD_LINK_PASSWORD');
  }

  private onModuleInit() {
    this.login(); // eslint-disable-line
  }

  @Interval(1000 * 60 * 60)
  private async login() {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    }).catch(() => null);

    const data = (await res?.json().catch(() => null)) as { token?: string } | null;
    if (data?.token) this.bearerToken = data.token;

    if (!this.bearerToken) {
      this.logger.error('Failed to login');
    }

    return !!(res?.ok && this.bearerToken);
  }

  public async unlinkPlayerTag(playerTag: string) {
    const res = await fetch(`${this.baseUrl}/links/${encodeURIComponent(playerTag)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
      },
    }).catch(() => null);

    if (!res?.ok) {
      this.logger.warn(`Failed to unlink playerTag ${playerTag}`);
    }

    return !!res?.ok;
  }

  public async getDiscordLinks(playerTagsOrUserIds: string[]) {
    if (!playerTagsOrUserIds.length) return [];

    const res = await fetch('https://cocdiscord.link/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(playerTagsOrUserIds),
    }).catch(() => null);

    const items = (await res?.json().catch(() => [])) as { playerTag: string; discordId: string }[];
    if (!Array.isArray(items)) return [];

    return items
      .filter((en) => TAG_REGEX.test(en.playerTag) && SNOWFLAKE_REGEX.test(en.discordId))
      .map((en) => ({
        tag: this.clashClient.util.parseTag(en.playerTag),
        userId: en.discordId,
        verified: false,
        displayName: 'Unknown',
        username: 'unknown',
      }));
  }
}
