import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClashClientService } from './clash-client.service';
import { ClashClient } from './client';
import { DiscordLinkService } from './discord-link.service';
import { KeyGenService } from './keygen.service';

@Global()
@Module({
  providers: [
    {
      provide: ClashClient,
      useFactory: (configService: ConfigService): ClashClient => {
        const keyString = configService.getOrThrow('CLASH_API_TOKENS');
        const keys = keyString.length ? keyString.split(',') : [];
        return new ClashClient({
          keys,
          rateLimit: 0,
          baseURL: configService.get('CLASH_API_BASE_URL'),
        });
      },
      inject: [ConfigService],
    },
    ClashClientService,
    DiscordLinkService,
    KeyGenService,
  ],
  exports: [ClashClientService, DiscordLinkService, ClashClient],
})
export class ClashClientModule {}
