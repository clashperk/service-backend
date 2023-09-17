import { Tokens } from '@app/constants';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class ElasticService {
  constructor(@Inject(Tokens.ELASTIC) )
}
