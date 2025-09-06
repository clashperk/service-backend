import { ClashClientService } from '@app/clash-client';
import { DiscordLinkService } from '@app/clash-client/discord-link.service';
import { DiscordOauthService } from '@app/discord-oauth';
import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections } from '../db/db.constants';
import { MONGODB_TOKEN } from '../db/mongodb.module';
import { CreateLinkInputDto } from './dto';

@Injectable()
export class LinksService {
  constructor(
    private clashClientService: ClashClientService,
    private discordOauthService: DiscordOauthService,
    private discordLinkService: DiscordLinkService,
    @Inject(MONGODB_TOKEN) private db: Db,
  ) {}

  public async getLinksByUserIds(userIds: string[]) {
    return this.links
      .find({ userId: { $in: userIds } }, { projection: this.projection })
      .sort({ order: 1 })
      .toArray();
  }

  public async getLinksByPlayerTags(playerTags: string[]) {
    return this.links
      .find({ tag: { $in: playerTags } }, { projection: this.projection })
      .sort({ order: 1 })
      .toArray();
  }

  public async createLink(userId: string, input: CreateLinkInputDto) {
    const existing = await this.links.findOne({ tag: input.playerTag });
    const isVerified = await this.clashClientService.verifyPlayerOrThrow(
      input.playerTag,
      input.apiToken,
    );

    if (existing && existing.userId !== input.userId && !isVerified) {
      throw new ConflictException('Player tag already linked to another user.');
    }

    const [user, player] = await Promise.all([
      this.discordOauthService.getUser(input.userId),
      this.clashClientService.getPlayerOrThrow(input.playerTag),
    ]);

    await this.links.updateOne(
      { tag: input.playerTag, userId: input.userId },
      {
        name: player.name,
        username: user.username,
        order: 0,
        verified: false,
        discriminator: user.discriminator,
        displayName: user.global_name || user.username,
        createdAt: new Date(),
        linkedBy: userId,
        source: 'bot',
      },
      { upsert: true },
    );

    return { message: 'Ok' };
  }

  public async deleteLink(userId: string, playerTag: string) {
    const { deletedCount } = await this.links.deleteOne({
      tag: playerTag,
      $or: [{ userId }, { linkedBy: userId }],
    });
    if (!deletedCount) {
      throw new ForbiddenException('You do not have permission to unlink this playerTag.');
    }

    await this.discordLinkService.unlinkPlayerTag(playerTag);

    return { message: 'Ok' };
  }

  private get projection() {
    return { _id: 0, tag: 1, name: 1, userId: 1, username: 1, order: 1, verified: 1 };
  }

  private get links() {
    return this.db.collection(Collections.PLAYER_LINKS);
  }
}
