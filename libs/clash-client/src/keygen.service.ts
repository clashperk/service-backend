import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClashClient } from './client';

@Injectable()
export class KeyGenService {
  private logger = new Logger(KeyGenService.name);

  constructor(
    private configService: ConfigService,
    private clashClient: ClashClient,
  ) {}

  onModuleInit() {
    this.login(); // eslint-disable-line
  }

  async login() {
    const email = this.configService.get('DEV_ACCOUNT_EMAIL');
    const password = this.configService.get('DEV_ACCOUNT_PASSWORD');

    if (!(email && password)) {
      this.logger.warn('No dev account credentials provided');
      return;
    }

    this.logger.log('Generating new keys...');

    const keys = await this.clashClient.login({
      email,
      password,
      keyCount: 10,
      keyName: this.configService.get('RAILWAY_SERVICE_NAME'),
      keyDescription: this.configService.get('RAILWAY_SERVICE_NAME'),
    });

    if (keys.length) {
      this.configService.set('CLASH_API_TOKENS', keys.join(','));
    }

    this.logger.log(`Generated ${keys.length} new keys`);
  }
}
