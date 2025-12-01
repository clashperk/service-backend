import { RedisKeys } from '@app/constants';
import { DiscordOauthService } from '@app/discord-oauth';
import { ErrorCodes } from '@app/dto';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN, REDIS_TOKEN } from '../db';
import {
  AuthUserDto,
  GenerateTokenDto,
  GenerateTokenInputDto,
  HandoffTokenInputDto,
  HandoffUserDto,
  JwtUser,
  JwtUserInput,
  LoginOkDto,
  UserRoles,
} from './dto';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);
  constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private jwtService: JwtService,
    private discordOauthService: DiscordOauthService,
  ) {}

  async login(passKey: string): Promise<LoginOkDto> {
    const user = await this.users.findOne({ passKey });
    if (!user) throw new UnauthorizedException(ErrorCodes.INVALID_PASSKEY);

    return {
      userId: user.userId,
      roles: user.roles,
      accessToken: this.createJwt(
        { userId: user.userId, roles: user.roles, username: user.username },
        { expiresIn: '2h' },
      ),
    };
  }

  async generateToken(input: GenerateTokenInputDto): Promise<GenerateTokenDto> {
    const user = await this.discordOauthService.getUser(input.userId);

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
          username: user.username,
          displayName: user.global_name || user.username,
          updatedAt: new Date(),
          deletedAt: null,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    if (!dto) {
      throw new UnauthorizedException(ErrorCodes.NOT_FOUND);
    }

    return {
      passKey: dto.passKey,
      userId: dto.userId,
      isBot: dto.isBot,
      roles: dto.roles,
      displayName: dto.displayName,
      accessToken: this.createJwt({
        userId: input.userId,
        roles: input.roles,
        username: dto.displayName,
      }),
    };
  }

  async getAuthUser(userId: string): Promise<AuthUserDto> {
    const user = await this.users.findOne({ userId });
    if (!user) throw new NotFoundException(ErrorCodes.NOT_FOUND);

    return {
      userId: user.userId,
      roles: user.roles,
      isBot: user.isBot,
      displayName: user.displayName,
    };
  }

  async decodeHandoffToken(token: string): Promise<HandoffUserDto> {
    const payload = await this.redis.get(`${RedisKeys.HANDOFF_TOKEN}:${token}`);
    if (!payload) throw new NotFoundException(ErrorCodes.HANDOFF_TOKEN_EXPIRED);

    const user = JSON.parse(payload) as {
      userId: string;
      guildId: string;
      avatar: string | null;
      username: string;
      displayName: string;
    };

    return {
      isBot: false,
      userId: user.userId,
      guildId: user.guildId,
      roles: [UserRoles.USER],
      username: user.username,
      displayName: user.displayName,
      avatarUrl: this.discordOauthService.buildAvatarUrl(user.userId, user.avatar),
    };
  }

  async createHandoffToken(payload: HandoffTokenInputDto) {
    const token = randomBytes(16).toString('hex');
    const user = await this.discordOauthService.getUser(payload.userId);

    const redisKey = `${RedisKeys.HANDOFF_TOKEN}:${token}`;
    await this.redis.set(
      redisKey,
      JSON.stringify({
        userId: user.id,
        guildId: payload.guildId,
        username: user.username,
        avatar: user.avatar || null,
        displayName: user.global_name || user.username,
      }),
      'EX',
      60 * 60,
    );
    return { token, user };
  }

  async revalidateJwtUser(payload: JwtUser) {
    if (payload.roles.includes(UserRoles.ADMIN)) return payload;

    const isBlocked = await this.redis.get(`${RedisKeys.USER_BLOCKED}:${payload.userId}`);
    if (isBlocked) throw new UnauthorizedException(ErrorCodes.USER_BLOCKED);

    return payload;
  }

  private createJwt(
    input: { userId: string; roles: UserRoles[]; username: string },
    options?: JwtSignOptions,
  ) {
    const payload = {
      userId: input.userId,
      roles: input.roles,
      version: '1',
      jti: randomUUID(),
      guildIds: [],
      username: input.username.toLowerCase(),
    } satisfies JwtUserInput;

    return this.jwtService.sign(payload, options);
  }

  private get users() {
    return this.db.collection(Collections.PORTAL_USERS);
  }
}
