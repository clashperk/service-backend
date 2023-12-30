import { JwtUser } from '@app/auth';
import { Tokens } from '@app/constants';
import { MongoDbService } from '@app/mongodb';
import { RedisClient, RedisService } from '@app/redis';
import RestHandler from '@app/rest/rest.module';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Db } from 'mongodb';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    @Inject(Tokens.MONGODB) private readonly db: Db,
    @Inject(Tokens.REDIS) private readonly redis: RedisClient,
    @Inject(Tokens.REST) private readonly restHandler: RestHandler,
    private readonly redisService: RedisService,
    private readonly mongoDbService: MongoDbService,
    private readonly jwtService: JwtService,
  ) {}

  async login(userId: string) {
    const payload = { sub: userId, jti: uuid() } satisfies Partial<JwtUser>;
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '30d' }),
    };
  }

  async validateJwt(jwtUser: JwtUser) {
    return jwtUser;
  }
}
