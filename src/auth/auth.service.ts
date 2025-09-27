import { RedisKeys } from '@app/constants';
import { DiscordOauthService } from '@app/discord-oauth';
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
import { Db, ObjectId } from 'mongodb';
import { ApiUsersEntity, Collections, MONGODB_TOKEN, REDIS_TOKEN } from '../db';
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
    if (!user) throw new UnauthorizedException('Invalid');

    return {
      userId: user.userId,
      roles: user.roles,
      accessToken: this.createJwt({ userId: user.userId, roles: user.roles }, { expiresIn: '2h' }),
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
      isBot: dto.isBot,
      roles: dto.roles,
      displayName: dto.displayName,
      accessToken: this.createJwt({ userId: input.userId, roles: input.roles }),
    };
  }

  async getAuthUser(userId: string): Promise<AuthUserDto> {
    const user = await this.users.findOne({ userId });
    if (!user) throw new NotFoundException();

    return {
      userId: user.userId,
      roles: user.roles,
      isBot: user.isBot,
      displayName: user.displayName,
    };
  }

  async decodeHandoffToken(token: string): Promise<HandoffUserDto> {
    const payload = await this.redis.get(`${RedisKeys.HANDOFF_TOKEN}:${token}`);
    if (!payload) throw new NotFoundException();

    const user = JSON.parse(payload) as {
      userId: string;
      guildId: string;
      avatar: string | null;
      displayName: string;
    };

    return {
      isBot: false,
      userId: user.userId,
      roles: [UserRoles.USER],
      displayName: user.displayName,
      avatarUrl: this.discordOauthService.buildAvatarUrl(user.userId, user.avatar),
    };
  }

  async createHandoffToken(payload: HandoffTokenInputDto) {
    const token = randomBytes(16).toString('hex');
    const user = await this.discordOauthService.getUser(payload.userId);

    await this.redis.set(
      `${RedisKeys.HANDOFF_TOKEN}:${token}`,
      JSON.stringify({
        userId: user.id,
        guildId: payload.guildId,
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
    if (isBlocked) throw new UnauthorizedException('Blocked');

    return payload;
  }

  private createJwt(input: { userId: string; roles: UserRoles[] }, options?: JwtSignOptions) {
    const payload = {
      userId: input.userId,
      roles: input.roles,
      version: '1',
      jti: randomUUID(),
    } satisfies JwtUserInput;

    return this.jwtService.sign(payload, options);
  }

  private get users() {
    return this.db.collection(Collections.PORTAL_USERS);
  }

  private async _update() {
    const users = await this.users.find().toArray();

    for (const user of users) {
      if (user.userId === 'vercel-user') continue;
      const discordUser = await this.discordOauthService.getUser(user.userId);

      const update: Partial<ApiUsersEntity> = {
        isBot: !!discordUser.bot,
        deletedAt: null,
        updatedAt: new Date(),
        displayName: discordUser.global_name || discordUser.username,
      };

      if (!user.createdAt) update.createdAt = new ObjectId(user._id).getTimestamp();

      await this.users.updateOne({ userId: user.userId }, { $set: update });
    }
  }
}
