import { RedisKeys } from '@app/constants';
import { BotNotInGuildException, DiscordRestService } from '@app/discord-rest';
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
import { toRoleIds } from '../guilds/manager-roles';
import { TokenAudience } from './app.constants';

const ADMINISTRATOR = BigInt(1 << 3);
const MANAGE_GUILD = BigInt(1 << 5);
import {
  AuthUserDto,
  GenerateTokenDto,
  GenerateTokenInputDto,
  HandoffGuildDto,
  HandoffTokenInputDto,
  HandoffUserDto,
  JwtUser,
  JwtUserInput,
  LoginOkDto,
  swaggerUser,
  UserRoles,
} from './dto';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);
  constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private jwtService: JwtService,
    private discordRest: DiscordRestService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async login(passKey: string): Promise<LoginOkDto> {
    const user = await this.users.findOneAndUpdate(
      { passKey, deletedAt: null },
      { $set: { lastLoginAt: new Date() } },
    );
    if (!user) throw new UnauthorizedException(ErrorCodes.INVALID_PASSKEY);

    return {
      userId: user.userId,
      roles: user.roles,
      accessToken: this.createJwt(
        {
          userId: user.userId,
          roles: user.roles,
          username: user.username,
          guildIds: user.guildIds,
        },
        { expiresIn: '2h' },
      ),
    };
  }

  async loginWithTurnstile(token: string, remoteIp: string): Promise<LoginOkDto> {
    await this.verifyTurnstile(token, remoteIp);

    return {
      userId: swaggerUser.userId,
      roles: swaggerUser.roles,
      accessToken: this.createJwt(
        {
          userId: swaggerUser.userId,
          roles: swaggerUser.roles,
          username: swaggerUser.username,
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
    const user = await this.discordRest.getUser(input.userId);

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
        guildIds: dto.guildIds,
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
      avatar: string | null;
      username: string;
      displayName: string;
      applicationId: string | null;
      guild: HandoffGuildDto | null;
    };

    return {
      isBot: false,
      userId: user.userId,
      guild: user.guild,
      roles: [UserRoles.USER],
      username: user.username,
      displayName: user.displayName,
      applicationId: user.applicationId,
      avatarUrl: this.discordRest.toAvatarUrl(user.userId, user.avatar),
    };
  }

  async createHandoffToken(payload: HandoffTokenInputDto) {
    const token = randomBytes(16).toString('hex');
    const user = await this.discordRest.getUser(payload.userId);

    const guild = await this.guilds.findOne(
      { guild: payload.guildId },
      { projection: { _id: 0, name: 1, iconUrl: 1 } },
    );

    // The bot links roster and links managers too; only full managers get the server.
    const canManage = await this.canManageGuild(
      payload.guildId,
      user.id,
      payload.applicationId || null,
    ).catch(() => false);

    const redisKey = `${RedisKeys.HANDOFF_TOKEN}:${token}`;
    await this.redis.set(
      redisKey,
      JSON.stringify({
        userId: user.id,
        guildId: canManage ? payload.guildId : null,
        guild: canManage
          ? {
              id: payload.guildId,
              name: guild?.name || 'Unknown',
              iconUrl: guild?.iconUrl || null,
            }
          : null,
        username: user.username,
        avatar: user.avatar || null,
        applicationId: payload.applicationId || null,
        displayName: user.global_name || user.username,
      }),
      'EX',
      60 * 60,
    );
    return { token, guild: { id: payload.guildId, ...guild }, user };
  }

  /** The subset of `guildIds` that ClashPerk is in, with each server's name, icon and clan count. */
  async getBotGuilds(guildIds: string[]) {
    const [guilds, clanCounts] = await Promise.all([
      this.guilds
        .find(
          { guild: { $in: guildIds } },
          { projection: { _id: 0, guild: 1, name: 1, iconUrl: 1 } },
        )
        .toArray(),
      this.clans
        .aggregate<{
          _id: string;
          count: number;
        }>([
          { $match: { guild: { $in: guildIds } } },
          { $group: { _id: '$guild', count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);
    const clansByGuild = new Map(clanCounts.map((row) => [row._id, row.count]));

    return {
      guilds: guilds.map((guild) => ({
        id: guild.guild as string,
        name: (guild.name as string) || 'Unknown',
        iconUrl: (guild.iconUrl as string) || null,
        clanCount: clansByGuild.get(guild.guild as string) ?? 0,
      })),
    };
  }

  /**
   * Whether the bot is in the server and the user can manage it (owner, Administrator, Manage
   * Server or the bot manager role). The dashboard asks when a server is picked and on renewals.
   */
  async getGuildAccess(input: { userId: string; guildId: string; applicationId?: string | null }) {
    try {
      const canManage = await this.canManageGuild(
        input.guildId,
        input.userId,
        input.applicationId ?? null,
      );
      return { hasBot: true, canManage };
    } catch (error) {
      if (error instanceof BotNotInGuildException) return { hasBot: false, canManage: false };
      throw error;
    }
  }

  async canManageGuild(guildId: string, userId: string, applicationId: string | null) {
    const bot = applicationId
      ? await this.db.collection(Collections.CUSTOM_BOTS).findOne({ serviceId: applicationId })
      : null;
    const token = bot?.token ?? null;
    const [guild, member, settings] = await Promise.all([
      this.discordRest.getGuild({ guildId, token }),
      this.discordRest.getMember({ guildId, userId, token }),
      this.db
        .collection(Collections.SETTINGS)
        .findOne({ guildId }, { projection: { managerRole: 1 } }),
    ]);
    if (!member) return false;
    if (guild.owner_id === userId) return true;

    // @everyone shares the server's ID and applies to every member.
    const roleIds = new Set([guildId, ...member.roles]);
    const permissions = guild.roles
      .filter((role) => roleIds.has(role.id))
      .reduce((bits, role) => bits | BigInt(role.permissions), BigInt(0));
    if ((permissions & (ADMINISTRATOR | MANAGE_GUILD)) !== BigInt(0)) return true;

    return toRoleIds(settings?.managerRole).some((id) => member.roles.includes(id));
  }

  /**
   * Servers where the user holds the bot manager role, which the bot treats like Manage Server.
   * Only servers that set the role are looked up on Discord.
   */
  async getManagedGuilds(userId: string, guildIds: string[]) {
    const settings = await this.db
      .collection(Collections.SETTINGS)
      .find(
        { guildId: { $in: guildIds }, managerRole: { $exists: true } },
        { projection: { guildId: 1, managerRole: 1 } },
      )
      .toArray();
    const managed = await Promise.all(
      settings.map(async ({ guildId, managerRole }) => {
        const roleIds = toRoleIds(managerRole);
        if (!roleIds.length) return null;
        const member = await this.discordRest
          .getMember({ guildId, userId, token: null })
          .catch(() => null);
        return member?.roles.some((id) => roleIds.includes(id)) ? guildId : null;
      }),
    );
    return { guildIds: managed.filter((id): id is string => id !== null) };
  }

  async revalidateJwtUser(payload: JwtUser) {
    if (payload.roles.includes(UserRoles.ADMIN)) return payload;

    const isBlocked = await this.redis.get(`${RedisKeys.USER_BLOCKED}:${payload.userId}`);
    if (isBlocked) throw new UnauthorizedException(ErrorCodes.USER_BLOCKED);

    return payload;
  }

  private createJwt(
    input: {
      userId: string;
      roles: UserRoles[];
      username: string;
      remoteIp?: string;
      guildIds?: string[];
    },
    options?: JwtSignOptions,
  ) {
    const payload = {
      userId: input.userId,
      roles: input.roles,
      version: 'v2',
      jti: randomUUID(),
      guildIds: input.guildIds || [],
      remoteIp: input.remoteIp,
      username: input.username.toLowerCase(),
    } satisfies JwtUserInput;

    return this.jwtService.sign(payload, { ...options, audience: TokenAudience.API });
  }

  private get users() {
    return this.db.collection(Collections.PORTAL_USERS);
  }

  private get guilds() {
    return this.db.collection(Collections.BOT_GUILDS);
  }

  private get clans() {
    return this.db.collection(Collections.CLAN_STORES);
  }
}
