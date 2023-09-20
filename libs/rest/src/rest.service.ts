import { Tokens } from '@app/constants';
import { Inject, Injectable } from '@nestjs/common';
import type { Client } from 'clashofclans.js';

@Injectable()
export class RestService {
  constructor(@Inject(Tokens.REST) private readonly restClient: Client) {}
}
