import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClashClientService } from './clash-client.service';
import { ClashClient } from './client';

@Global()
@Module({
  providers: [
    {
      provide: ClashClient,
      useFactory: (configService: ConfigService): ClashClient => {
        return new ClashClient({
          rateLimit: 0,
          baseURL: configService.getOrThrow('CLASH_API_BASE_URL'),
          keys: configService.getOrThrow<string>('CLASH_API_TOKENS').split(','),
        });
      },
      inject: [ConfigService],
    },
    ClashClientService,
  ],
  exports: [ClashClientService, ClashClient],
})
export class ClashClientModule {}
