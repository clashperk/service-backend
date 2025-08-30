import { DiscordClientService } from '@app/discord-client';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { Db } from 'mongodb';
import { RedisKeys } from '../app.constants';
import { Collections } from '../db/db.constants';
import { MONGODB_TOKEN } from '../db/mongodb.module';
import { REDIS_TOKEN } from '../db/redis.module';
import { JwtUser, JwtUserInput } from './decorators';
import { GenerateTokenDto, GenerateTokenInputDto, LoginOkDto, UserRoles } from './dto';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);
  constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private jwtService: JwtService,
    private discordClientService: DiscordClientService,
  ) {}

  async login(passKey: string): Promise<LoginOkDto> {
    const user = await this.users.findOne({ passKey });
    if (!user) throw new UnauthorizedException('Invalid');

    return {
      userId: user.userId,
      roles: user.roles,
      accessToken: this.createJwt({ userId: user.userId, roles: user.roles }, { expiresIn: '2h' }),
    };
  }

  async generateToken(input: GenerateTokenInputDto): Promise<GenerateTokenDto> {
    const user = await this.discordClientService.getUser(input.userId);

    const dto = await this.users.findOneAndUpdate(
      { userId: input.userId },
      {
        $setOnInsert: {
          createdAt: new Date(),
          passKey: randomBytes(16).toString('hex'),
        },
        $set: {
          userId: input.userId,
          roles: input.roles,
          isBot: !!user.bot,
          displayName: user.global_name || user.username,
          updatedAt: new Date(),
          deletedAt: null,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    if (!dto) {
      throw new UnauthorizedException('Failed');
    }

    return {
      passKey: dto.passKey,
      userId: dto.userId,
      displayName: dto.displayName,
      isBot: dto.isBot,
      roles: dto.roles,
      accessToken: this.createJwt({ userId: input.userId, roles: input.roles }),
    };
  }

  async revalidateJwtUser(payload: JwtUser) {
    if (payload.roles.includes(UserRoles.ADMIN)) return payload;

    const isBlocked = await this.redis.get(`${RedisKeys.USER_BLOCKED}:${payload.userId}`);
    if (isBlocked) throw new UnauthorizedException('Blocked');

    return payload;
  }

  private createJwt(input: { userId: string; roles: UserRoles[] }, options?: JwtSignOptions) {
    const payload = {
      userId: input.userId,
      roles: input.roles,
      version: '1',
    } satisfies JwtUserInput;

    return this.jwtService.sign(payload, options);
  }

  private get users() {
    return this.db.collection(Collections.PORTAL_USERS);
  }
}
