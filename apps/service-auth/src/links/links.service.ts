import { ClashClientService } from '@app/clash-client';
import { Collections } from '@app/constants';
import { DiscordClientService } from '@app/discord-client';
import { PlayerLinksEntity } from '@app/entities';
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Collection } from 'mongodb';
import { CreateLinkInput } from './dto/create-links.dto';
import { DeleteLinkInput } from './dto/delete-link.dto';

@Injectable()
export class LinksService {
  private logger = new Logger(LinksService.name);

  constructor(
    private discordClientService: DiscordClientService,
    private clashClientService: ClashClientService,

    @Inject(Collections.PLAYER_LINKS)
    private playerLinksCollection: Collection<PlayerLinksEntity>,
  ) {}

  async createLink(input: CreateLinkInput) {
    const player = await this.clashClientService.getPlayerOrThrow(input.playerTag);
    const user = await this.discordClientService.getUser(input.userId);

    const links = await this.playerLinksCollection.find({ userId: input.userId }).toArray();

    await this.playerLinksCollection.insertOne({
      name: player.name,
      tag: player.tag,
      userId: input.userId,
      username: user.username,
      displayName: user.global_name ?? user.username,
      discriminator: user.discriminator,
      order: links.length ? Math.max(...links.map((link) => link.order)) + 1 : 0,
      source: 'web',
      verified: false,
      createdAt: new Date(),
    });

    this.logger.log(
      `Creating link for ${player.name} (${player.tag}) - ${user.username} (${input.userId})`,
    );

    return { message: 'OK' };
  }

  private async postUnlinkActions(authUserId: string, playerTag: string) {
    const [authUserLinks, target] = await Promise.all([
      this.playerLinksCollection.find({ userId: authUserId, verified: true }).toArray(),
      this.playerLinksCollection.findOne({ tag: playerTag }),
    ]);
    if (!target) throw new NotFoundException('Target player not found.');

    if (target.userId !== authUserId && target.verified) {
      throw new ForbiddenException('You cannot unlink an account that is verified.');
    }

    if (target.userId === authUserId) return;

    const player = await this.clashClientService.getPlayer(playerTag);
    if (player?.clan) {
      const clan = await this.clashClientService.getClanOrThrow(player.clan.tag);

      const authUserPlayerTags = authUserLinks.map((link) => link.tag);
      const isLeader = clan.memberList.some(
        (member) =>
          authUserPlayerTags.includes(member.tag) && ['leader', 'coLeader'].includes(member.role),
      );

      if (!isLeader) {
        throw new ForbiddenException(
          'You can only unlink, if you are a verified Leader/Co-Leader in the clan.',
        );
      }
    } else {
      throw new ForbiddenException('The player is no longer in your clan.');
    }
  }

  async deleteLink(userId: string, input: DeleteLinkInput) {
    await this.postUnlinkActions(userId, input.playerTag);
    await this.playerLinksCollection.deleteOne({ tag: input.playerTag });
    return { message: 'OK' };
  }

  async getLinksById(userIdOrTag: string) {
    const isDiscordUserId = /^\d{17,19}/.test(userIdOrTag);
    const where = isDiscordUserId ? { userId: userIdOrTag } : { tag: userIdOrTag };

    return this.playerLinksCollection
      .find(where)
      .project({
        _id: 0,
        name: 1,
        tag: 1,
        userId: 1,
        username: 1,
        order: 1,
        verified: 1,
      })
      .sort({ order: 1 })
      .toArray();
  }

  async getLinks(input: string[]) {
    const isDiscordUserIds = input.every((id) => /^\d{17,19}/.test(id));
    const where = isDiscordUserIds ? { userId: { $in: input } } : { tag: { $in: input } };

    return this.playerLinksCollection
      .find(where)
      .project({
        _id: 0,
        name: 1,
        tag: 1,
        userId: 1,
        username: 1,
        order: 1,
        verified: 1,
      })
      .sort({ order: 1 })
      .toArray();
  }
}
