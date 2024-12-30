import { Collections } from '@app/constants';
import { DiscordOAuthUsersEntity } from '@app/entities/discord-oauth-users.entity';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Collection } from 'mongodb';

@Injectable()
export class DiscordOAuthService {
  constructor(
    private configService: ConfigService,

    @Inject(Collections.DISCORD_OAUTH_USERS)
    private discordOAuthUsersCollection: Collection<DiscordOAuthUsersEntity>,
  ) {}

  public async storeDiscordTokens(userId: string, tokens: DiscordOAuthUsersEntity['tokens']) {
    await this.discordOAuthUsersCollection.updateOne(
      { userId },
      {
        $set: {
          tokens: {
            access_token: tokens.access_token,
            expires_at: tokens.expires_at,
            refresh_token: tokens.refresh_token,
          },
        },
      },
      { upsert: true },
    );
  }

  private async getDiscordTokens(userId: string) {
    const user = await this.discordOAuthUsersCollection.findOne({ userId });
    return user?.tokens ?? null;
  }

  /**
   * Generate the url which the user will be directed to in order to approve the
   * bot, and see the list of requested scopes.
   */
  getOAuth2Url(joinGuilds = false) {
    const state = joinGuilds ? `guilds.join-${randomUUID()}` : randomUUID();

    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.set('client_id', this.configService.getOrThrow<string>('DISCORD_CLIENT_ID'));
    url.searchParams.set(
      'redirect_uri',
      this.configService.getOrThrow<string>('DISCORD_REDIRECT_URI'),
    );
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);

    if (joinGuilds) {
      url.searchParams.set('scope', 'identify guilds.join');
    } else {
      url.searchParams.set('scope', 'role_connections.write identify');
    }

    url.searchParams.set('prompt', 'consent');

    return { state, url: url.toString() };
  }

  /**
   * Given an OAuth2 code from the scope approval page, make a request to Discord's
   * OAuth2 service to retrieve an access token, refresh token, and expiration.
   */
  async getOAuthTokens(code: string) {
    const url = 'https://discord.com/api/v10/oauth2/token';
    const body = new URLSearchParams({
      client_id: this.configService.getOrThrow<string>('DISCORD_CLIENT_ID'),
      client_secret: this.configService.getOrThrow<string>('DISCORD_CLIENT_SECRET'),
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.configService.getOrThrow<string>('DISCORD_REDIRECT_URI'),
    });

    const res = await fetch(url, {
      body,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    } else {
      throw new InternalServerErrorException(
        `Error fetching OAuth tokens: [${res.status}] ${res.statusText}`,
      );
    }
  }

  /**
   * The initial token request comes with both an access token and a refresh
   * token.  Check if the access token has expired, and if it has, use the
   * refresh token to acquire a new, fresh access token.
   */
  async getAccessToken(userId: string, tokens: DiscordOAuthUsersEntity['tokens']) {
    if (tokens && Date.now() > tokens.expires_at) {
      const url = 'https://discord.com/api/v10/oauth2/token';
      const body = new URLSearchParams({
        client_id: this.configService.getOrThrow<string>('DISCORD_CLIENT_ID'),
        client_secret: this.configService.getOrThrow<string>('DISCORD_CLIENT_SECRET'),
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      });

      const res = await fetch(url, {
        body,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (res.ok) {
        const tokens = await res.json();
        tokens.expires_at = Date.now() + tokens.expires_in * 1000;
        await this.storeDiscordTokens(userId, tokens);
        return tokens.access_token;
      } else {
        throw new InternalServerErrorException(
          `Error refreshing access token: [${res.status}] ${res.statusText}`,
        );
      }
    }

    return tokens.access_token;
  }

  async getUserData(tokens: DiscordOAuthUsersEntity['tokens']) {
    const url = 'https://discord.com/api/v10/oauth2/@me';
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    } else {
      throw new InternalServerErrorException(
        `Error fetching user data: [${res.status}] ${res.statusText}`,
      );
    }
  }

  /**
   * Given metadata that matches the schema, push that data to Discord on behalf
   * of the current user.
   */
  async pushMetadata(
    userId: string,
    metadata: Record<string, string | number>,
    tokens: DiscordOAuthUsersEntity['tokens'],
  ) {
    const clientId = this.configService.getOrThrow<string>('DISCORD_CLIENT_ID');
    const url = `https://discord.com/api/v10/users/@me/applications/${clientId}/role-connection`;
    const accessToken = await this.getAccessToken(userId, tokens);

    const body = {
      platform_name: metadata.username,
      metadata,
    };
    const res = await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new InternalServerErrorException(
        `Error pushing discord metadata: [${res.status}] ${res.statusText}`,
      );
    }
  }

  /**
   * Fetch the metadata currently pushed to Discord for the currently logged
   * in user, for this specific bot.
   */
  async getMetadata(userId: string, tokens: DiscordOAuthUsersEntity['tokens']) {
    const clientId = this.configService.getOrThrow<string>('DISCORD_CLIENT_ID');
    const url = `https://discord.com/api/v10/users/@me/applications/${clientId}/role-connection`;
    const accessToken = await this.getAccessToken(userId, tokens);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    } else {
      throw new InternalServerErrorException(
        `Error getting discord metadata: [${res.status}] ${res.statusText}`,
      );
    }
  }

  /**
   * Register the metadata to be stored by Discord. This should be a one time action.
   * Note: uses a Bot token for authentication, not a user token.
   */
  async registerMetadata() {
    const clientId = this.configService.getOrThrow<string>('DISCORD_CLIENT_ID');
    const url = `https://discord.com/api/v10/applications/${clientId}/role-connections/metadata`;
    // supported types: number_lt=1, number_gt=2, number_eq=3 number_neq=4, datetime_lt=5, datetime_gt=6, boolean_eq=7, boolean_neq=8
    const body = [
      {
        key: 'trophies',
        name: 'Trophies',
        description: 'Minimum number of trophies',
        type: 2,
      },
      {
        key: 'verified',
        name: 'Verified',
        description: 'Has verified account',
        type: 7,
      },
    ];

    const res = await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${this.configService.getOrThrow<string>('DISCORD_BOT_TOKEN')}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    } else {
      throw new InternalServerErrorException(
        `Error pushing discord metadata schema: [${res.status}] ${res.statusText}`,
      );
    }
  }

  async joinGuild(userId: string, guildId: string, tokens: DiscordOAuthUsersEntity['tokens']) {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${this.configService.getOrThrow<string>('DISCORD_TOKEN')}`,
      },
      body: JSON.stringify({
        access_token: tokens.access_token,
      }),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Error joining guild: [${res.status}] ${res.statusText}`,
      );
    }
  }
}
