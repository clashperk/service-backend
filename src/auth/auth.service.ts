import { RedisKeys } from '@app/constants';
import { DiscordOauthService } from '@app/discord-oauth';
import { ErrorCodes } from '@app/dto';
import { HttpService } from '@nestjs/axios';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Db } from 'mongodb';
import { firstValueFrom } from 'rxjs';
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
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async login(passKey: string): Promise<LoginOkDto> {
    const user = await this.users.findOneAndUpdate(
      { passKey },
      { $set: { lastLoginAt: new Date() } },
    );
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

  async loginWithTurnstile(token: string, remoteIp: string): Promise<LoginOkDto> {
    await this.verifyTurnstile(token, remoteIp);
    const swaggerUserId = '000000000000000000';

    return {
      userId: swaggerUserId,
      roles: [UserRoles.VIEWER],
      accessToken: this.createJwt(
        {
          userId: swaggerUserId,
          roles: [UserRoles.VIEWER],
          username: 'swagger_user',
          remoteIp,
        },
        { expiresIn: '5m' },
      ),
    };
  }

  private async verifyTurnstile(token: string, remoteIp: string) {
    const secret = this.configService.getOrThrow('CLOUDFLARE_TURNSTILE_SECRET_KEY');

    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);
    body.append('remoteip', remoteIp);

    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const { data: validation } = await firstValueFrom(
      this.httpService.post<{ success: boolean; challenge_ts: string; hostname: string }>(
        url,
        body,
      ),
    );

    if (!validation.success) {
      throw new UnauthorizedException('Invalid Turnstile Token');
    }

    if (Date.now() - new Date(validation.challenge_ts).getTime() > 5000) {
      throw new UnauthorizedException('Invalid Turnstile Token (Expired)');
    }

    if (!validation.hostname.includes('clashperk.com')) {
      throw new UnauthorizedException('Invalid Turnstile Token (Hostname)');
    }

    return { message: 'Ok' };
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
    input: { userId: string; roles: UserRoles[]; username: string; remoteIp?: string },
    options?: JwtSignOptions,
  ) {
    const payload = {
      userId: input.userId,
      roles: input.roles,
      version: '1',
      jti: randomUUID(),
      guildIds: [],
      remoteIp: input.remoteIp,
      username: input.username.toLowerCase(),
    } satisfies JwtUserInput;

    return this.jwtService.sign(payload, options);
  }

  private get users() {
    return this.db.collection(Collections.PORTAL_USERS);
  }
}
