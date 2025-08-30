import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { Db } from 'mongodb';

import { DiscordClientService } from '@app/discord-client';
import { RedisKeys } from '../app.constants';
import { Collections } from '../db/db.constants';
import { MONGODB_TOKEN } from '../db/mongodb.module';
import { REDIS_TOKEN } from '../db/redis.module';
import { JwtUser, JwtUserInput } from './decorators';
import { GenerateTokenInputDto, UserRoles } from './dto';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);
  constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private jwtService: JwtService,
    private discordClientService: DiscordClientService,
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
    const user = await this.discordClientService.getUser(input.userId);

    const dto = {
      userId: input.userId,
      roles: input.roles,
      isBot: !!user.bot,
      username: user.username,
      displayName: user.global_name || user.username,
    };

    await this.users.updateOne({ userId: input.userId }, { $set: dto }, { upsert: true });

    return {
      ...dto,
      accessToken: this.createJwt({ userId: input.userId, roles: input.roles }),
    };
  }

  async validateJwtUser(payload: JwtUser) {
    const [key, startTime] = [`${RedisKeys.BLOCKED}:${payload.userId}`, Date.now()];
    const isBlocked = await this.redis.get(key);
    this.logger.log(`Checked blocked status in ${Date.now() - startTime}ms`);

    if (isBlocked) {
      throw new UnauthorizedException('User is blocked');
    }
    return payload;
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
