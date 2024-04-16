import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class DiscordLinkService {
  private bearerToken: string;

  private onModuleInit() {
    this.login();
  }

  @Interval(1000 * 60 * 60)
  private async login() {
    const res = await fetch('https://cocdiscord.link/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: process.env.DISCORD_LINK_USERNAME,
        password: process.env.DISCORD_LINK_PASSWORD,
      }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { token?: string } | null;

    if (data?.token) this.bearerToken = data.token;
    return res?.status === 200 && this.bearerToken;
  }

  public async unlinkPlayerTag(playerTag: string) {
    const res = await fetch(`https://cocdiscord.link/links/${encodeURIComponent(playerTag)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
      },
    }).catch(() => null);

    return Promise.resolve(res?.status === 200);
  }
}
