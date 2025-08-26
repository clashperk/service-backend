import { Module } from '@nestjs/common';
import { DiscordOauthService } from './discord-oauth.service';

@Module({
  providers: [DiscordOauthService],
  exports: [DiscordOauthService],
})
export class DiscordOauthModule {}
