import { Tokens } from '@app/constants';
import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';

@Injectable()
export class MongodbService {
  constructor(@Inject(Tokens.MONGODB) private readonly db: Db) {}
}
