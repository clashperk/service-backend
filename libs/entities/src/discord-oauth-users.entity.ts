export interface DiscordOAuthUsersEntity {
  userId: string;
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}
