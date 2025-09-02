import { Global, Module } from '@nestjs/common';
import { DiscordOauthService } from './discord-oauth.service';

@Global()
@Module({
  providers: [DiscordOauthService],
  exports: [DiscordOauthService],
})
export class DiscordOauthModule {}
