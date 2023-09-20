import { Tokens } from '@app/constants';
import { Module, Provider } from '@nestjs/common';
import { Client } from 'clashofclans.js';
import { RestService } from './rest.service';

const RestProvider: Provider = {
  provide: Tokens.REST,
  useFactory: (): Client => {
    return new Client();
  },
};

@Module({
  providers: [RestService, RestProvider],
  exports: [RestService, RestProvider],
})
export class RestModule {}
