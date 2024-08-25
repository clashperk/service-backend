import { Module } from '@nestjs/common';
import { DiscordOAuthService } from './discord-oauth.service';

@Module({
  providers: [DiscordOAuthService],
  exports: [DiscordOAuthService],
})
export class DiscordOAuthModule {}
