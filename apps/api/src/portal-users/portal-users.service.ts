import { DiscordRestService } from '@app/discord-rest';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  /** New roles apply the next time the account signs in. */
  async edit(userId: string, roles: UserRoles[]): Promise<PortalUserDto> {
    await this.findEditable(userId);
    const user = await this.users.findOneAndUpdate(
      { userId, deletedAt: null },
      { $set: { roles: [...new Set(roles)], updatedAt: new Date() } },
      { projection: { passKey: 0 }, returnDocument: 'after' },
    );
    return toDto(user!);
  }

  /** The passkey stops working at once; a token it already got lasts until it expires. */
  async revoke(userId: string) {
    await this.findEditable(userId);
    await this.users.updateOne(
      { userId, deletedAt: null },
      { $set: { deletedAt: new Date(), passKey: randomBytes(16).toString('hex') } },
    );
    return this.list();
  }

  private async findEditable(userId: string) {
    const user = await this.users.findOne({ userId, deletedAt: null });
    if (!user) throw new NotFoundException('No portal account for that user.');
    if (user.roles.includes(UserRoles.ADMIN)) {
      throw new BadRequestException("Admin accounts can't be changed from the dashboard.");
    }
  }

  private get users() {
    return this.db.collection(Collections.PORTAL_USERS);
  }
}
