import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { Db } from 'mongodb';
import { MONGODB_TOKEN } from '../db/mongodb.module';
import { REDIS_TOKEN } from '../db/redis.module';
import { JwtUser, JwtUserInput } from './decorators';
import { UserRoles } from './dto/roles.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    private jwtService: JwtService,
  ) {}

  login(token: string) {
    try {
      return this.jwtService.verify(token) as unknown as JwtUser;
    } catch {
      throw new UnauthorizedException();
    }
  }

  async generateToken() {
    return Promise.resolve(
      this.jwtService.sign({
        userId: '1',
        roles: [UserRoles.Admin],
        version: '1.0',
      } satisfies JwtUserInput),
    );
  }
}
