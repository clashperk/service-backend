import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { Db } from 'mongodb';

import { Collections } from '../db/db.constants';
import { MONGODB_TOKEN } from '../db/mongodb.module';
import { REDIS_TOKEN } from '../db/redis.module';
import { JwtUserInput } from './decorators';
import { GenerateTokenInputDto, UserRoles } from './dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private jwtService: JwtService,
  ) {}

  async login(userId: string) {
    const user = await this.users.findOne({ userId });

    const roles = user ? user.roles : [UserRoles.USER];
    return {
      userId,
      roles,
      accessToken: this.createJwt({ userId, roles }),
    };
  }

  async generateToken(input: GenerateTokenInputDto) {
    await this.users.updateOne(
      { userId: input.userId },
      { $set: { userId: input.userId, roles: input.roles } },
      { upsert: true },
    );

    return {
      userId: input.userId,
      roles: input.roles,
      accessToken: this.createJwt({ userId: input.userId, roles: input.roles }),
    };
  }

  private createJwt(input: { userId: string; roles: UserRoles[] }) {
    return this.jwtService.sign({
      userId: input.userId,
      roles: input.roles,
      version: '1',
    } satisfies JwtUserInput);
  }

  private get users() {
    return this.db.collection(Collections.API_USERS);
  }
}
