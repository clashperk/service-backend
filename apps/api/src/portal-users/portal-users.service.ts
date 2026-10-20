import { DiscordRestService } from '@app/discord-rest';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Db, WithId } from 'mongodb';
import { ApiUsersEntity } from '@app/collections';
import { Collections, MONGODB_TOKEN } from '../db';
import { AddedPortalUserDto, PortalUserDto, PortalUsersDto } from './dto/portal-users.dto';
import { UserRoles } from '@app/dto';

const toDto = (user: WithId<ApiUsersEntity>): PortalUserDto => ({
  userId: user.userId,
  username: user.username,
  displayName: user.displayName,
  isBot: user.isBot,
  roles: user.roles,
  createdAt: user.createdAt ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
});

@Injectable()
export class PortalUsersService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discordRest: DiscordRestService,
  ) {}

  /** Newest first, without passkeys. */
  async list(): Promise<PortalUsersDto> {
    const users = await this.users
      .find({ deletedAt: null }, { projection: { passKey: 0 }, sort: { createdAt: -1 } })
      .toArray();
    return { users: users.map(toDto) };
  }

  /** Made as `/auth/generate-passkey` makes them, but never over an existing account. */
  async add(input: { userId: string; roles: UserRoles[] }): Promise<AddedPortalUserDto> {
    if (await this.users.findOne({ userId: input.userId, deletedAt: null })) {
      throw new ConflictException('That Discord user already has a portal account.');
    }
    const discordUser = await this.discordRest.getUser(input.userId);
    const now = new Date();
    const user = await this.users.findOneAndUpdate(
      { userId: input.userId },
      {
        $set: {
          userId: input.userId,
          roles: [...new Set(input.roles)],
          passKey: randomBytes(16).toString('hex'),
          isBot: !!discordUser.bot,
          username: discordUser.username,
          displayName: discordUser.global_name || discordUser.username,
          updatedAt: now,
          deletedAt: null,
        },
        $setOnInsert: { createdAt: now, guildIds: [] },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return { user: toDto(user!), passKey: user!.passKey };
  }

  private get users() {
    return this.db.collection(Collections.PORTAL_USERS);
  }
}
