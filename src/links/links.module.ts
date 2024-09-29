import { ClashClientModule } from '@app/clash-client';
import { DiscordClientModule } from '@app/discord-client';
import { Module } from '@nestjs/common';
import { DiscordLinkService } from './discord-link.service';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

@Module({
  imports: [ClashClientModule, DiscordClientModule],
  controllers: [LinksController],
  providers: [LinksService, DiscordLinkService],
})
export class LinksModule {}
