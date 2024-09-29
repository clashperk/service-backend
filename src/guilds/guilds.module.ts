import { DiscordClientModule } from '@app/discord-client';
import { Module } from '@nestjs/common';
import { GuildsController } from './guilds.controller';
import { GuildsService } from './guilds.service';

@Module({
  imports: [DiscordClientModule],
  controllers: [GuildsController],
  providers: [GuildsService],
})
export class GuildsModule {}
