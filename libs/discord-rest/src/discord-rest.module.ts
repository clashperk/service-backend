import { Global, Module } from '@nestjs/common';
import { DiscordRestService } from './discord-rest.service';

@Global()
@Module({
  providers: [DiscordRestService],
  exports: [DiscordRestService],
})
export class DiscordRestModule {}
