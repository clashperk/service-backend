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
import { AddedDeveloperDto, DeveloperDto, DevelopersDto } from './dto/developers.dto';
import { UserRoles } from '@app/dto';

const toDto = (user: WithId<ApiUsersEntity>): DeveloperDto => ({
  userId: user.userId,
  username: user.username,
  displayName: user.displayName,
  isBot: user.isBot,
  roles: user.roles,
  createdAt: user.createdAt ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
});

@Injectable()
export class DevelopersService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discordRest: DiscordRestService,
  ) {}

  /** Newest first, without passkeys. */
  async list(): Promise<DevelopersDto> {
    const developers = await this.developers
      .find({ deletedAt: null }, { projection: { passKey: 0 }, sort: { createdAt: -1 } })
      .toArray();
    return { developers: developers.map(toDto) };
  }

  /** Made as `/auth/generate-passkey` makes them, but never over an existing account. */
  async add(input: { userId: string; roles: UserRoles[] }): Promise<AddedDeveloperDto> {
    if (await this.developers.findOne({ userId: input.userId, deletedAt: null })) {
      throw new ConflictException('That Discord user is already a developer.');
    }
    const discordUser = await this.discordRest.getUser(input.userId);
    const now = new Date();
    const user = await this.developers.findOneAndUpdate(
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
    return { developer: toDto(user!), passKey: user!.passKey };
  }

  /** New roles apply the next time the account signs in. */
  async edit(userId: string, roles: UserRoles[]): Promise<DeveloperDto> {
    await this.findEditable(userId);
    const user = await this.developers.findOneAndUpdate(
      { userId, deletedAt: null },
      { $set: { roles: [...new Set(roles)], updatedAt: new Date() } },
      { projection: { passKey: 0 }, returnDocument: 'after' },
    );
    return toDto(user!);
  }

  /** The passkey stops working at once; a token it already got lasts until it expires. */
  async revoke(userId: string) {
    await this.findEditable(userId);
    await this.developers.updateOne(
      { userId, deletedAt: null },
      { $set: { deletedAt: new Date(), passKey: randomBytes(16).toString('hex') } },
    );
    return this.list();
  }

  private async findEditable(userId: string) {
    const user = await this.developers.findOne({ userId, deletedAt: null });
    if (!user) throw new NotFoundException('No developer account for that user.');
    if (user.roles.includes(UserRoles.ADMIN)) {
      throw new BadRequestException("Admin accounts can't be changed from the dashboard.");
    }
  }

  private get developers() {
    return this.db.collection(Collections.PORTAL_USERS);
  }
}
