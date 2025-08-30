import { Global, Module } from '@nestjs/common';
import { DiscordClientService } from './discord-client.service';

@Global()
@Module({
  providers: [DiscordClientService],
  exports: [DiscordClientService],
})
export class DiscordClientModule {}
