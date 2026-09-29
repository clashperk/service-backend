import { ClashClientService } from '@app/clash-client';
import { DiscordLinkService } from '@app/clash-client/discord-link.service';
import { DiscordOauthService } from '@app/discord-oauth';
import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { PlayerLinksEntity } from '@app/collections';
import { Collections, MONGODB_TOKEN } from '../db';
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
    const { apiToken, playerTag, userId: targetUserId } = input;
    const existing = await this.links.findOne({ tag: playerTag });
    const isVerified = await this.clashClientService.verifyPlayerOrThrow(playerTag, apiToken);

    if (existing && existing.userId !== targetUserId && !isVerified) {
      throw new ConflictException('Player tag already linked to another user.');
    }

    const [user, player] = await Promise.all([
      this.discordOauthService.getUser(targetUserId),
      this.clashClientService.getPlayerOrThrow(playerTag),
    ]);

    await this.links.updateOne(
      { tag: player.tag },
      {
        $set: {
          userId: targetUserId,
          name: player.name,
          username: user.username,
          discriminator: user.discriminator,
          displayName: user.global_name || user.username,
          verified: isVerified || (existing?.userId === targetUserId && existing.verified),
          linkedBy: userId,
        },
        $setOnInsert: {
          order: 0,
          source: 'bot',
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return { message: 'Ok' };
  }

  public async deleteLink(input: { userId: string; playerTag: string; isAdmin: boolean }) {
    const { userId, playerTag, isAdmin } = input;

    const link = await this.links.findOne({ tag: playerTag });
    if (!link) return { message: 'Ok' };

    if (!isAdmin) await this.assertCanUnlink(userId, link);

    await this.links.deleteOne({ tag: playerTag });
    await this.discordLinkService.unlinkPlayerTag(playerTag);

    await this.auditLogs.insertOne({
      tag: playerTag,
      userId,
      link,
      action: 'unlink',
      createdAt: new Date(),
    });

    return { message: 'Ok' };
  }

  /** Owners and linkers can always unlink; verified Leaders/Co-Leaders can unlink unverified members. */
  private async assertCanUnlink(userId: string, link: PlayerLinksEntity) {
    if (link.userId === userId || link.linkedBy === userId) return;

    if (link.verified) {
      throw new ForbiddenException('You cannot unlink an account that is verified.');
    }

    const player = await this.clashClientService.getPlayer(link.tag);
    if (!player?.clan) {
      throw new ForbiddenException('The player is no longer in your clan.');
    }

    const [clan, userLinks] = await Promise.all([
      this.clashClientService.getClanOrThrow(player.clan.tag),
      this.links.find({ userId, verified: true }, { projection: { tag: 1 } }).toArray(),
    ]);

    const userTags = new Set(userLinks.map((link) => link.tag));
    const isLeader = clan.memberList.some(
      (member) => userTags.has(member.tag) && ['leader', 'coLeader'].includes(member.role),
    );

    if (!isLeader) {
      throw new ForbiddenException(
        'You can only unlink, if you are a verified Leader/Co-Leader in the clan.',
      );
    }
  }

  private get projection() {
    return { _id: 0, tag: 1, name: 1, userId: 1, username: 1, order: 1, verified: 1 };
  }

  private get links() {
    return this.db.collection(Collections.PLAYER_LINKS);
  }

  private get auditLogs() {
    return this.db.collection(Collections.PLAYER_LINK_AUDIT_LOGS);
  }
}
