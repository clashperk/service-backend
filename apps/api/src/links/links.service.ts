import { ClashClientService } from '@app/clash-client';
import { DiscordLinkService } from '@app/clash-client/discord-link.service';
import { DiscordRestService } from '@app/discord-rest';
import { fixTag } from '@app/helpers';
import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { PlayerLinksEntity } from '@app/collections';
import { Collections, MONGODB_TOKEN } from '../db';
import { CreateLinkInputDto } from './dto';

@Injectable()
export class LinksService {
  constructor(
    private clashClientService: ClashClientService,
    private discordRest: DiscordRestService,
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

  public async createLink(caller: { userId: string; isAdmin: boolean }, input: CreateLinkInputDto) {
    const { userId, isAdmin } = caller;
    const { apiToken, userId: targetUserId } = input;
    // Check and write by the tag the game returns: a differently spelled tag must not miss the link.
    const player = await this.clashClientService.getPlayerOrThrow(input.playerTag);
    const existing = await this.links.findOne({ tag: player.tag });
    const isVerified = await this.clashClientService.verifyPlayerOrThrow(player.tag, apiToken);

    if (existing && existing.userId !== targetUserId && !isVerified) {
      throw new ConflictException('Player tag already linked to another user.');
    }

    const user = await this.discordRest.getUser(targetUserId);

    if (targetUserId !== userId && !isAdmin) {
      if (!player.clan || !(await this.isVerifiedClanLeader(userId, player.clan.tag))) {
        throw new ForbiddenException(
          'You can only link for others, if you are a verified Leader/Co-Leader in the clan.',
        );
      }
    }

    // A new account goes last, like the bot's /verify, so linking never changes the default.
    // Re-linking an account the user already owns keeps its place.
    const ownLink = existing?.userId === targetUserId;
    const lastLink = ownLink
      ? null
      : await this.links.findOne({ userId: targetUserId }, { sort: { order: -1 } });
    const order = ownLink ? {} : { order: lastLink ? (lastLink.order ?? 0) + 1 : 0 };

    await this.links.updateOne(
      { tag: player.tag },
      {
        $set: {
          userId: targetUserId,
          name: player.name,
          username: user.username,
          discriminator: user.discriminator,
          displayName: user.global_name || user.username,
          verified: isVerified || (ownLink && existing.verified),
          linkedBy: userId,
          ...order,
        },
        $setOnInsert: {
          source: 'web',
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return { message: 'Ok' };
  }

  public async deleteLink(input: { userId: string; playerTag: string; isAdmin: boolean }) {
    const { userId, isAdmin } = input;
    const playerTag = fixTag(input.playerTag);

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

  /**
   * Makes one of the user's own links their default account. The default is the link
   * with the lowest `order`, the same rule the bot's link command uses.
   */
  public async setDefaultLink(input: { userId: string; playerTag: string }) {
    const { userId } = input;
    const playerTag = fixTag(input.playerTag);

    const link = await this.links.findOne({ tag: playerTag });
    if (!link || link.userId !== userId) {
      throw new ForbiddenException('You can only change the default for your own accounts.');
    }

    const [first] = await this.links
      .find({ userId, tag: { $ne: link.tag } }, { projection: { order: 1 } })
      .sort({ order: 1 })
      .limit(1)
      .toArray();

    // Ties go to whichever link the database returns first, so it must be strictly lower.
    if (first && (link.order ?? 0) >= (first.order ?? 0)) {
      await this.links.updateOne(
        { tag: link.tag },
        { $set: { order: (first.order ?? 0) - 1, updatedAt: new Date() } },
      );
    }

    return { message: 'Ok' };
  }

  /**
   * Only the owner can unlink a verified account. Unverified links can be removed by
   * whoever created them, or by a verified Leader/Co-Leader of the player's clan.
   */
  private async assertCanUnlink(userId: string, link: PlayerLinksEntity) {
    if (link.userId !== userId && link.verified) {
      throw new ForbiddenException('You cannot unlink an account that is verified.');
    }

    if (link.userId === userId || link.linkedBy === userId) return;

    const player = await this.clashClientService.getPlayer(link.tag);
    if (!player?.clan) {
      throw new ForbiddenException('The player is no longer in your clan.');
    }

    if (!(await this.isVerifiedClanLeader(userId, player.clan.tag))) {
      throw new ForbiddenException(
        'You can only unlink, if you are a verified Leader/Co-Leader in the clan.',
      );
    }
  }

  private async isVerifiedClanLeader(userId: string, clanTag: string) {
    const [clan, userLinks] = await Promise.all([
      this.clashClientService.getClanOrThrow(clanTag),
      this.links.find({ userId, verified: true }, { projection: { tag: 1 } }).toArray(),
    ]);

    const userTags = new Set(userLinks.map((link) => link.tag));
    return clan.memberList.some(
      (member) => userTags.has(member.tag) && ['leader', 'coLeader'].includes(member.role),
    );
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
