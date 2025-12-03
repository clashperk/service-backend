import { ClashClientService } from '@app/clash-client';
import { ErrorCodes } from '@app/dto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APIPlayer } from 'clashofclans.js';
import { Db, ObjectId, WithId } from 'mongodb';
import { Collections, MONGODB_TOKEN, PlayerLinksEntity, RostersEntity } from '../db';

@Injectable()
export class RostersService {
  constructor(
    private clashClientService: ClashClientService,
    @Inject(MONGODB_TOKEN) private db: Db,
  ) {}

  async getRoster(input: { rosterId: string; guildId: string }) {
    const roster = await this.rosters.findOne({
      _id: new ObjectId(input.rosterId),
      guildId: input.guildId,
    });
    if (roster) return roster;
    throw new NotFoundException(ErrorCodes.NOT_FOUND);
  }

  async getRosters(guildId: string) {
    const [rosters, categories] = await Promise.all([
      this.rosters.find({ guildId }, { sort: { _id: -1 } }).toArray(),
      this.groups.find({ guildId }, { sort: { _id: -1 } }).toArray(),
    ]);

    return { rosters, categories };
  }

  async transferRosterMembers({
    rosterId,
    playerTags,
    newRosterId,
    newGroupId,
  }: {
    rosterId: string;
    guildId: string;
    playerTags: string[];
    newRosterId: string;
    newGroupId: string;
  }) {
    if (rosterId === newRosterId && newGroupId) {
      const roster = await this.swapMemberGroups({
        rosterId,
        playerTags,
        newCategoryId: newGroupId,
      });

      return { roster, result: [] };
    }

    return this.swapRoster({
      rosterId,
      playerTags,
      newRosterId,
      categoryId: newGroupId,
    });
  }

  async deleteRosterMembers({
    rosterId,
    guildId,
    playerTags,
  }: {
    rosterId: string;
    guildId: string;
    playerTags: string[];
  }) {
    await this.rosters.updateOne(
      { _id: new ObjectId(rosterId), guildId },
      { $pull: { members: { tag: { $in: playerTags } } } },
    );

    return this.getRosterById(rosterId);
  }

  private async getRosterById(rosterId: string) {
    const roster = await this.rosters.findOne({ _id: new ObjectId(rosterId) });
    if (roster) return roster;
    throw new NotFoundException(ErrorCodes.NOT_FOUND);
  }

  private async swapMemberGroups({
    newCategoryId,
    playerTags,
    rosterId,
  }: {
    rosterId: string;
    playerTags: string[];
    newCategoryId: string;
  }) {
    const category = await this.groups.findOne({
      _id: new ObjectId(newCategoryId),
    });
    if (!category) throw new NotFoundException(ErrorCodes.NOT_FOUND);

    await Promise.all(
      playerTags.map(async (playerTag) => {
        await this.rosters.updateOne(
          { '_id': new ObjectId(rosterId), 'members.tag': playerTag },
          { $set: { 'members.$.categoryId': category._id } },
        );
      }),
    );

    return this.getRosterById(rosterId);
  }

  private async swapRoster({
    rosterId,
    newRosterId,
    playerTags,
    categoryId,
  }: {
    rosterId: string;
    playerTags: string[];
    newRosterId: string;
    categoryId: string | null;
  }) {
    const result = await Promise.all(
      playerTags.map(async (playerTag) => {
        const player = await this.clashClientService.getPlayerOrThrow(playerTag);
        const link = await this.links.findOne({ tag: player.tag });

        const newRoster = await this.getRosterById(newRosterId);
        const result = await this.attemptSignup({
          roster: newRoster,
          player,
          isDryRun: true,
          isOwner: false,
          link,
        });

        if (result.success) {
          // OPT OUT FROM THE OLD ROSTER
          await this.rosters.updateOne(
            { _id: new ObjectId(rosterId) },
            { $pull: { members: { tag: playerTag } } },
          );

          // SIGNUP TO THE NEW ROSTER
          await this.signupUser({ roster: newRoster, player, link, categoryId });
        }

        return { ...result, player: { tag: player.tag, name: player.name } };
      }),
    );

    const roster = await this.getRosterById(rosterId);
    return { roster, result };
  }

  private async signupUser({
    roster,
    player,
    link,
    categoryId,
  }: {
    roster: WithId<RostersEntity>;
    player: APIPlayer;
    link: PlayerLinksEntity | null;
    categoryId?: string | null;
  }) {
    const category = categoryId
      ? await this.groups.findOne({ _id: new ObjectId(categoryId) })
      : null;

    const heroes = player.heroes.filter((hero) => hero.village === 'home');
    const member: RostersEntity['members'][number] = {
      name: player.name,
      tag: player.tag,
      userId: link?.userId ?? null,
      username: link?.displayName ?? null,
      warPreference: player.warPreference ?? null,
      role: player.role ?? null,
      trophies: player.trophies,
      heroes: heroes.reduce((prev, curr) => ({ ...prev, [curr.name]: curr.level }), {}),
      townHallLevel: player.townHallLevel,
      clan: player.clan ? { name: player.clan.name, tag: player.clan.tag } : null,
      categoryId: category ? category._id : null,
      createdAt: new Date(),
    };

    await this.rosters.updateOne({ _id: roster._id }, { $push: { members: { ...member } } });

    return this.getRosterById(roster._id.toHexString());
  }

  private async attemptSignup({
    roster,
    player,
    link,
    isOwner,
    isDryRun = false,
  }: {
    roster: WithId<RostersEntity>;
    player: APIPlayer;
    link: PlayerLinksEntity | null;
    isOwner: boolean;
    isDryRun: boolean;
  }) {
    if (roster.startTime && roster.startTime > new Date()) {
      return {
        success: false,
        message: 'This roster is not opened.',
      };
    }

    if (roster.closed || (roster.endTime ? roster.endTime < new Date() : false)) {
      return {
        success: false,
        message: 'This roster is closed.',
      };
    }

    if (!link && !roster.allowUnlinked) {
      return {
        success: false,
        message: isOwner
          ? `You are not linked to any players. Please link your account with /link or use the \`allow_unlinked\` option to allow unlinked players to signup.`
          : `This player is not linked to any users. Please link their account with /link or use the \`allow_unlinked\` option to allow unlinked players to signup.`,
      };
    }

    const maxMembers = roster.maxMembers ?? 50;
    if (roster.members.length >= maxMembers) {
      return {
        success: false,
        message: `This roster is full (maximum ${maxMembers} members).`,
      };
    }

    if (roster.minTownHall && player.townHallLevel < roster.minTownHall) {
      return {
        success: false,
        message: `This roster requires a minimum Town Hall level of ${roster.minTownHall}.`,
      };
    }

    if (roster.maxTownHall && player.townHallLevel > roster.maxTownHall) {
      return {
        success: false,
        message: `This roster requires a maximum Town Hall level of ${roster.maxTownHall}.`,
      };
    }

    const heroes = player.heroes.filter((hero) => hero.village === 'home');
    const sumOfHeroLevels = heroes.reduce((prev, curr) => prev + curr.level, 0);
    if (roster.minHeroLevels && sumOfHeroLevels < roster.minHeroLevels) {
      return {
        success: false,
        message: `This roster requires a minimum combined hero level of ${roster.minHeroLevels}.`,
      };
    }

    if (roster.members.some((m) => m.tag === player.tag)) {
      return {
        success: false,
        message: isOwner
          ? 'You are already signed up for this roster.'
          : 'This player is already signed up for this roster.',
      };
    }

    if (!roster.allowMultiSignup && !isDryRun) {
      const dup = await this.rosters.findOne(
        {
          '_id': { $ne: roster._id },
          'closed': false,
          'guildId': roster.guildId,
          'members.tag': player.tag,
          'category': roster.category,
        },
        { projection: { members: 0 } },
      );
      if (dup) {
        return {
          success: false,
          message: isOwner
            ? `You are already signed up for another roster (${dup.clan.name} - ${dup.name})`
            : `This player is already signed up for another roster (${dup.clan.name} - ${dup.name})`,
        };
      }
    }

    if (roster.allowMultiSignup && !isDryRun) {
      const dup = await this.rosters.findOne(
        {
          '_id': { $ne: roster._id },
          'closed': false,
          'guildId': roster.guildId,
          'members.tag': player.tag,
          'allowMultiSignup': false,
          'category': roster.category,
        },
        { projection: { members: 0 } },
      );
      if (dup && !dup.allowMultiSignup) {
        return {
          success: false,
          message: isOwner
            ? `You are already signed up for another roster (${dup.clan.name} - ${dup.name}) that does not allow multi-signup.`
            : `This player is already signed up for another roster (${dup.clan.name} - ${dup.name}) that does not allow multi-signup.`,
        };
      }
    }

    return { success: true, message: 'OK' };
  }

  private get rosters() {
    return this.db.collection(Collections.ROSTERS);
  }

  private get groups() {
    return this.db.collection(Collections.ROSTER_GROUPS);
  }

  private get links() {
    return this.db.collection(Collections.PLAYER_LINKS);
  }
}
