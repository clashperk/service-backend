import { fixTag } from '@app/helpers';
import { ClashClientService } from '@app/clash-client';
import { ErrorCodes } from '@app/dto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { APIClan, APIPlayer } from 'clashofclans.js';
import { Db, ObjectId, WithId } from 'mongodb';
import {
  Collections,
  MONGODB_TOKEN,
  PlayerLinksEntity,
  RosterGroupsEntity,
  RosterMemberOfRostersEntity,
  RostersEntity,
} from '../db';
import {
  RosterCategory,
  RosterGroupInput,
  RosterGroupUpdateInput,
  RosterInput,
  RosterPlayerCheckDto,
  RosterSortBy,
  RosterUpdateInput,
  ROSTER_LAYOUT_KEYS,
} from './dto';

// The bot's numbers: an unset max is 65; new rosters start from the server's last-used settings.
const ROSTER_MAX_LIMIT = 65;
const UNRANKED_TIER_ID = 105000000;
const UNRANKED_WAR_LEAGUE_ID = 48000000;
const DEFAULT_TROPHY_LAYOUT = '#/TH_ICON/TROPHIES/NAME';
const MINUTE = 60 * 1000;

type Roster = WithId<RostersEntity>;
type Member = RosterMemberOfRostersEntity;
type User = { id: string; username: string; displayName: string };
type DefaultSettings = Partial<{
  allowMultiSignup: boolean;
  allowCategorySelection: boolean;
  requireCategorySelection: boolean;
  allowUnlinked: boolean;
  maxMembers: number;
  minHeroLevels: number;
  minTownHall: number;
  maxTownHall: number;
  sortBy: string;
  layout: string;
  colorCode: number;
  useClanAlias: boolean;
}>;

const groupKey = (name: string) => name.toLowerCase().trim().replace(/\s+/g, '_');
const homeHeroes = (player: APIPlayer) => player.heroes.filter((hero) => hero.village === 'home');
const heroLevels = (player: APIPlayer) =>
  homeHeroes(player).reduce((total, hero) => total + hero.level, 0);
const isClosed = (roster: RostersEntity) =>
  roster.closed || (roster.endTime ? roster.endTime < new Date() : false);
const rosterLabel = (roster: RostersEntity) =>
  roster.clan ? `${roster.clan.name} - ${roster.name}` : roster.name;

function toMember(player: APIPlayer, user: User | null, categoryId: ObjectId | null): Member {
  return {
    name: player.name,
    tag: player.tag,
    userId: user?.id ?? null,
    username: user?.username ?? null,
    displayName: user?.displayName ?? null,
    warPreference: player.warPreference ?? null,
    role: player.role ?? null,
    trophies: player.trophies,
    leagueId: player.leagueTier?.id ?? UNRANKED_TIER_ID,
    heroes: Object.fromEntries(homeHeroes(player).map((hero) => [hero.name, hero.level])),
    townHallLevel: player.townHallLevel,
    clan: player.clan ? { name: player.clan.name, tag: player.clan.tag } : null,
    categoryId,
    createdAt: new Date(),
  };
}

/** Rosters as `/roster` stores them; the bot reads them fresh, so no reload is needed. */
@Injectable()
export class RostersService {
  constructor(
    private clashClientService: ClashClientService,
    @Inject(MONGODB_TOKEN) private db: Db,
  ) {}

  async getRoster(input: { rosterId: string; guildId: string }) {
    if (!ObjectId.isValid(input.rosterId)) throw new NotFoundException(ErrorCodes.NOT_FOUND);

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
      this.groups.find({ guildId }, { sort: { order: 1 } }).toArray(),
    ]);

    return { rosters, categories };
  }

  async createRoster(guildId: string, body: RosterInput) {
    await this.createDefaultGroups(guildId);
    const clan = body.clanTag ? await this.getClanOrThrow(body.clanTag) : null;
    const defaults = await this.getDefaultSettings(guildId);
    const category = body.category ?? RosterCategory.GENERAL;
    const startTime = body.startTime ? new Date(body.startTime) : null;
    const endTime = body.endTime ? new Date(body.endTime) : null;

    const roster: RostersEntity = {
      _id: new ObjectId(),
      name: body.name,
      guildId,
      clan: clan ? this.toRosterClan(clan) : null,
      category,
      closed: false,
      allowMultiSignup: body.allowMultiSignup ?? defaults.allowMultiSignup ?? true,
      allowCategorySelection:
        body.allowCategorySelection ??
        body.requireCategorySelection ??
        defaults.allowCategorySelection ??
        true,
      requireCategorySelection:
        body.requireCategorySelection ?? defaults.requireCategorySelection ?? false,
      allowUnlinked: body.allowUnlinked ?? defaults.allowUnlinked ?? false,
      maxMembers: body.maxMembers ?? defaults.maxMembers,
      sortBy:
        body.sortBy ??
        (category === RosterCategory.TROPHY ? RosterSortBy.TROPHIES : defaults.sortBy),
      layout:
        body.layout ??
        (category === RosterCategory.TROPHY ? DEFAULT_TROPHY_LAYOUT : defaults.layout),
      minHeroLevels: body.minHeroLevels ?? defaults.minHeroLevels,
      minTownHall: body.minTownHall ?? defaults.minTownHall,
      maxTownHall: body.maxTownHall ?? defaults.maxTownHall,
      useClanAlias: body.useClanAlias ?? defaults.useClanAlias,
      maxAccountsPerUser: body.maxAccountsPerUser ?? null,
      rosterImage: body.rosterImage ?? null,
      categorySelectionCustomText: body.categorySelectionCustomText ?? null,
      roleId: body.roleId ?? null,
      colorCode: body.colorCode ?? defaults.colorCode,
      members: [],
      startTime,
      endTime,
      lastUpdated: new Date(),
      createdAt: new Date(),
    };
    // The bot leaves unset fields out of the record instead of storing undefined.
    for (const key of Object.keys(roster) as (keyof RostersEntity)[]) {
      if (roster[key] === undefined) delete roster[key];
    }

    this.checkLayout(roster.layout);
    this.checkTimes({ startTime, endTime, newStart: !!startTime, newEnd: !!endTime });
    this.checkGroupSelection(roster);
    if (roster.roleId) await this.checkRoleFree(roster.roleId, null, { closedToo: false });

    await this.rosters.insertOne(roster);
    await this.setDefaultSettings(guildId, roster);
    if (body.importMembers && clan) {
      await this.addMembers({
        guildId,
        rosterId: roster._id.toHexString(),
        playerTags: clan.memberList.map((member) => member.tag),
        groupId: null,
      });
    }
    return this.getRoster({ rosterId: roster._id.toHexString(), guildId });
  }

  async updateRoster(guildId: string, rosterId: string, body: RosterUpdateInput) {
    const roster = await this.getRoster({ rosterId, guildId });
    const set: Partial<RostersEntity> = {};

    if (body.clanTag !== undefined) {
      set.clan = body.clanTag ? this.toRosterClan(await this.getClanOrThrow(body.clanTag)) : null;
    }
    const copy = [
      'name',
      'category',
      'allowUnlinked',
      'allowMultiSignup',
      'allowCategorySelection',
      'requireCategorySelection',
      'categorySelectionCustomText',
      'maxMembers',
      'maxAccountsPerUser',
      'minTownHall',
      'maxTownHall',
      'minHeroLevels',
      'roleId',
      'sortBy',
      'layout',
      'useClanAlias',
      'colorCode',
      'rosterImage',
      'closed',
    ] as const;
    for (const key of copy) {
      if (body[key] !== undefined) (set as Record<string, unknown>)[key] = body[key];
    }
    if (body.startTime !== undefined)
      set.startTime = body.startTime ? new Date(body.startTime) : null;
    if (body.endTime !== undefined) set.endTime = body.endTime ? new Date(body.endTime) : null;

    const next = { ...roster, ...set };
    this.checkLayout(set.layout);
    this.checkTimes({
      startTime: next.startTime ?? null,
      endTime: next.endTime ?? null,
      newStart: !!set.startTime,
      newEnd: !!set.endTime,
    });
    this.checkGroupSelection(next);
    if (set.roleId) await this.checkRoleFree(set.roleId, roster._id, { closedToo: true });

    // Members already on another open roster block single sign-up, as `/roster edit` and reopening do.
    const turnsOffMulti = set.allowMultiSignup === false && roster.allowMultiSignup !== false;
    const reopens = set.closed === false && roster.closed && next.allowMultiSignup === false;
    if ((turnsOffMulti || reopens) && roster.members.length) {
      const dup = await this.rosters.findOne(
        {
          '_id': { $ne: roster._id },
          'closed': false,
          'category': next.category,
          'guildId': guildId,
          'members.tag': { $in: roster.members.map((member) => member.tag) },
        },
        { projection: { name: 1, clan: 1 } },
      );
      if (dup) {
        throw new ConflictException(
          `Some players are also on ${rosterLabel(dup)}. Remove them or close that roster first.`,
        );
      }
    }

    if (Object.keys(set).length) {
      await this.rosters.updateOne({ _id: roster._id }, { $set: set });
      await this.setDefaultSettings(guildId, next);
    }
    return this.getRoster({ rosterId, guildId });
  }

  /** Roster and group roles stay with members until the bot's next role refresh. */
  async deleteRoster(guildId: string, rosterId: string) {
    const roster = await this.getRoster({ rosterId, guildId });
    await this.rosters.deleteOne({ _id: roster._id });
  }

  /** As `/roster clone`: the settings without role, image, color or log channel, then members re-checked. */
  async cloneRoster(guildId: string, rosterId: string, name?: string) {
    const source = await this.getRoster({ rosterId, guildId });
    await this.createDefaultGroups(guildId);
    const now = new Date();
    const future = (time?: Date | null) => (time && time > now ? time : null);

    const clone: RostersEntity = {
      _id: new ObjectId(),
      name: name ?? `${source.name} [CLONE]`.slice(0, 30),
      guildId,
      clan: source.clan,
      category: source.category,
      closed: false,
      allowMultiSignup: source.allowMultiSignup,
      allowCategorySelection: source.allowCategorySelection,
      allowUnlinked: source.allowUnlinked,
      maxMembers: source.maxMembers,
      sortBy: source.sortBy,
      layout: source.layout,
      minTownHall: source.minTownHall,
      maxTownHall: source.maxTownHall,
      minHeroLevels: source.minHeroLevels,
      useClanAlias: source.useClanAlias,
      roleId: null,
      members: [],
      startTime: future(source.startTime),
      endTime: future(source.endTime),
      lastUpdated: now,
      createdAt: now,
    };
    for (const key of Object.keys(clone) as (keyof RostersEntity)[]) {
      if (clone[key] === undefined) delete clone[key];
    }
    await this.rosters.insertOne(clone);

    const byGroup = new Map<string, string[]>();
    for (const member of source.members) {
      const key = member.categoryId?.toHexString() ?? '';
      byGroup.set(key, [...(byGroup.get(key) ?? []), member.tag]);
    }
    for (const [groupId, playerTags] of byGroup) {
      await this.addMembers({
        guildId,
        rosterId: clone._id.toHexString(),
        playerTags,
        groupId: groupId || null,
      });
    }
    return this.getRoster({ rosterId: clone._id.toHexString(), guildId });
  }

  /** Runs the sign-up checks without saving, so a manager sees who can join first. */
  async checkMembers(input: { guildId: string; rosterId: string; playerTags: string[] }) {
    const roster = await this.getRoster(input);
    const { results } = await this.evaluate(roster, input.playerTags);
    return results.map(({ check }) => check);
  }

  async addMembers(input: {
    guildId: string;
    rosterId: string;
    playerTags: string[];
    groupId?: string | null;
  }) {
    const roster = await this.getRoster(input);
    const group = input.groupId ? await this.getGroup(input.guildId, input.groupId) : null;
    const { results } = await this.evaluate(roster, input.playerTags);

    const joining = results.filter((r) => r.check.canJoin && r.player);
    if (joining.length) {
      await this.rosters.updateOne(
        { _id: roster._id },
        {
          $push: {
            members: {
              $each: joining.map((r) => toMember(r.player!, r.user, group?._id ?? null)),
            },
          },
        },
      );
    }
    return {
      roster: await this.getRoster(input),
      result: results.map(({ check }) => check),
    };
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

    return this.getRoster({ rosterId, guildId });
  }

  async transferRosterMembers({
    rosterId,
    guildId,
    playerTags,
    newRosterId,
    newGroupId,
  }: {
    rosterId: string;
    guildId: string;
    playerTags: string[];
    newRosterId?: string;
    newGroupId?: string;
  }) {
    const roster = await this.getRoster({ rosterId, guildId });
    const group = newGroupId ? await this.getGroup(guildId, newGroupId) : null;

    if (!newRosterId || newRosterId === rosterId) {
      if (!group) throw new BadRequestException('newRosterId or newGroupId is required.');
      for (const playerTag of playerTags) {
        await this.rosters.updateOne(
          { '_id': roster._id, 'members.tag': playerTag },
          { $set: { 'members.$.categoryId': group._id } },
        );
      }
      return { roster: await this.getRoster({ rosterId, guildId }), result: [] };
    }

    // Moving is a sign-up on the target that ignores the source roster, then an opt-out from it.
    const target = await this.getRoster({ rosterId: newRosterId, guildId });
    const moving = roster.members.filter((member) => playerTags.includes(member.tag));
    const { results } = await this.evaluate(
      target,
      moving.map((member) => member.tag),
      roster._id,
    );
    const joining = results.filter((r) => r.check.canJoin && r.player);
    if (joining.length) {
      const groups = new Map(moving.map((member) => [member.tag, member.categoryId ?? null]));
      await this.rosters.updateOne(
        { _id: target._id },
        {
          $push: {
            members: {
              $each: joining.map((r) =>
                toMember(r.player!, r.user, group?._id ?? groups.get(r.player!.tag) ?? null),
              ),
            },
          },
        },
      );
      await this.rosters.updateOne(
        { _id: roster._id },
        { $pull: { members: { tag: { $in: joining.map((r) => r.player!.tag) } } } },
      );
    }

    return {
      roster: await this.getRoster({ rosterId, guildId }),
      result: results.map(({ check }) => ({
        player: { tag: check.tag, name: check.name ?? check.tag },
        success: check.canJoin,
        message: check.reason ?? 'Moved.',
      })),
    };
  }

  /** Re-reads every member from the game and their links, as the bot's Refresh button does. */
  async refreshMembers(guildId: string, rosterId: string) {
    const roster = await this.getRoster({ rosterId, guildId });
    const tags = roster.members.map((member) => member.tag);
    const [players, links] = await Promise.all([
      this.clashClientService.getPlayers(tags),
      this.links.find({ tag: { $in: tags } }).toArray(),
    ]);
    const playersByTag = new Map(players.map((player) => [player.tag, player]));
    const linksByTag = new Map(links.map((link) => [link.tag, link]));

    const members = roster.members.map((member) => {
      const player = playersByTag.get(member.tag);
      if (!player) return member;
      const fresh = toMember(player, this.toUser(linksByTag.get(member.tag)), null);
      return { ...fresh, categoryId: member.categoryId ?? null, createdAt: member.createdAt };
    });
    const clan = roster.clan ? await this.clashClientService.getClan(roster.clan.tag) : null;

    await this.rosters.updateOne(
      { _id: roster._id },
      {
        $set: {
          members,
          lastUpdated: new Date(),
          ...(clan ? { clan: this.toRosterClan(clan) } : {}),
        },
      },
    );
    return this.getRoster({ rosterId, guildId });
  }

  async createGroup(guildId: string, body: RosterGroupInput) {
    await this.checkGroupName(guildId, body.name);
    if (body.roleId) await this.checkGroupRoleFree(guildId, body.roleId);
    const last = await this.groups.findOne({ guildId }, { sort: { order: -1 } });
    await this.groups.insertOne({
      _id: new ObjectId(),
      guildId,
      name: groupKey(body.name),
      displayName: body.name,
      order: (last?.order ?? 0) + 10,
      selectable: body.selectable ?? false,
      roleId: body.roleId ?? null,
      createdAt: new Date(),
    });
    return this.getRosters(guildId);
  }

  async updateGroup(guildId: string, groupId: string, body: RosterGroupUpdateInput) {
    const group = await this.getGroup(guildId, groupId);
    const set: Partial<RosterGroupsEntity> = {};
    if (body.name !== undefined) {
      await this.checkGroupName(guildId, body.name, group._id);
      set.name = groupKey(body.name);
      set.displayName = body.name;
    }
    if (body.roleId !== undefined) {
      if (body.roleId) await this.checkGroupRoleFree(guildId, body.roleId, group._id);
      set.roleId = body.roleId;
    }
    if (body.selectable !== undefined) set.selectable = body.selectable;
    if (body.order !== undefined) set.order = body.order;
    if (Object.keys(set).length) await this.groups.updateOne({ _id: group._id }, { $set: set });
    return this.getRosters(guildId);
  }

  /** Members keep the deleted group's ID and show as ungrouped, as with `/roster groups modify`. */
  async deleteGroup(guildId: string, groupId: string) {
    const group = await this.getGroup(guildId, groupId);
    await this.groups.deleteOne({ _id: group._id });
    return this.getRosters(guildId);
  }

  /**
   * The bot's `attemptSignup` for each player in order, counting earlier ones toward the roster's
   * size and per-member limits. `ignoreRosterId` skips the roster a player is being moved from.
   */
  private async evaluate(roster: Roster, rawTags: string[], ignoreRosterId?: ObjectId) {
    const tags = [...new Set(rawTags.map(fixTag))];
    const [players, links] = await Promise.all([
      this.clashClientService.getPlayers(tags),
      this.links.find({ tag: { $in: tags } }).toArray(),
    ]);
    const playersByTag = new Map(players.map((player) => [player.tag, player]));
    const linksByTag = new Map(links.map((link) => [link.tag, link]));
    const others = await this.rosters
      .find(
        {
          '_id': { $nin: [roster._id, ...(ignoreRosterId ? [ignoreRosterId] : [])] },
          'closed': false,
          'guildId': roster.guildId,
          'category': roster.category,
          'members.tag': { $in: tags },
        },
        { projection: { 'name': 1, 'clan': 1, 'allowMultiSignup': 1, 'members.tag': 1 } },
      )
      .toArray();

    const members = [...roster.members];
    const maxMembers = roster.maxMembers ?? ROSTER_MAX_LIMIT;
    const results = tags.map((tag) => {
      const player = playersByTag.get(tag);
      const user = this.toUser(linksByTag.get(tag));
      const reason = player
        ? this.signupProblem({ roster, members, maxMembers, player, user, others })
        : 'No player has this tag.';
      if (player && !reason) members.push(toMember(player, user, null));
      const check: RosterPlayerCheckDto = {
        tag: player?.tag ?? tag,
        name: player?.name ?? null,
        townHallLevel: player?.townHallLevel ?? null,
        heroLevels: player ? heroLevels(player) : null,
        clanRole: player?.role ?? null,
        user,
        canJoin: !reason,
        reason,
      };
      return { check, player, user };
    });
    return { results };
  }

  private signupProblem(input: {
    roster: Roster;
    members: Member[];
    maxMembers: number;
    player: APIPlayer;
    user: User | null;
    others: RostersEntity[];
  }) {
    const { roster, members, player, user } = input;
    if (roster.startTime && roster.startTime > new Date()) return 'This roster hasn’t opened yet.';
    if (isClosed(roster)) return 'This roster is closed.';
    if (!user && !roster.allowUnlinked) return 'This player isn’t linked to a Discord member.';
    if (members.length >= input.maxMembers) {
      return `This roster is full (maximum ${input.maxMembers} players).`;
    }
    if (roster.maxAccountsPerUser && user) {
      const count = members.filter((member) => member.userId === user.id).length;
      if (count >= roster.maxAccountsPerUser) {
        return `This member already has ${roster.maxAccountsPerUser} accounts on the roster.`;
      }
    }
    if (roster.minTownHall && player.townHallLevel < roster.minTownHall) {
      return `Needs Town Hall ${roster.minTownHall} or higher.`;
    }
    if (roster.maxTownHall && player.townHallLevel > roster.maxTownHall) {
      return `Needs Town Hall ${roster.maxTownHall} or lower.`;
    }
    if (roster.minHeroLevels && heroLevels(player) < roster.minHeroLevels) {
      return `Needs ${roster.minHeroLevels} combined hero levels.`;
    }
    if (members.some((member) => member.tag === player.tag)) return 'Already on this roster.';

    const elsewhere = input.others.find((other) =>
      other.members.some((member) => member.tag === player.tag),
    );
    if (elsewhere && roster.allowMultiSignup === false) {
      return `Already on ${rosterLabel(elsewhere)}.`;
    }
    const strict = input.others.find(
      (other) =>
        other.allowMultiSignup === false &&
        other.members.some((member) => member.tag === player.tag),
    );
    if (strict) return `Already on ${rosterLabel(strict)}, which allows one roster per player.`;
    return null;
  }

  private toUser(link: PlayerLinksEntity | undefined): User | null {
    return link
      ? { id: link.userId, username: link.username, displayName: link.displayName }
      : null;
  }

  private toRosterClan(clan: APIClan): NonNullable<RostersEntity['clan']> {
    return {
      tag: clan.tag,
      name: clan.name,
      badgeUrl: clan.badgeUrls.large,
      league: {
        id: clan.warLeague?.id ?? UNRANKED_WAR_LEAGUE_ID,
        name: clan.warLeague?.name ?? 'Unranked',
      },
    };
  }

  private async getClanOrThrow(clanTag: string) {
    const clan = await this.clashClientService.getClan(fixTag(clanTag));
    if (!clan) throw new NotFoundException('No clan has that tag.');
    return clan;
  }

  private checkLayout(layout: string | undefined) {
    if (!layout) return;
    const keys = layout.split('/');
    if (
      keys.length < 3 ||
      keys.length > 5 ||
      !keys.every((key) => ROSTER_LAYOUT_KEYS.includes(key))
    ) {
      throw new BadRequestException('Pick 3 to 5 columns for the roster.');
    }
  }

  private checkTimes(input: {
    startTime: Date | null;
    endTime: Date | null;
    newStart: boolean;
    newEnd: boolean;
  }) {
    const soon = new Date(Date.now() + 5 * MINUTE);
    if (input.newStart && input.startTime! < soon) {
      throw new BadRequestException('Sign-ups must open at least 5 minutes from now.');
    }
    if (input.newEnd && input.endTime! < soon) {
      throw new BadRequestException('Sign-ups must close at least 5 minutes from now.');
    }
    if (input.startTime && input.endTime) {
      if (input.endTime < input.startTime) {
        throw new BadRequestException('Sign-ups can’t close before they open.');
      }
      if (input.endTime.getTime() - input.startTime.getTime() < 10 * MINUTE) {
        throw new BadRequestException('Sign-ups must stay open at least 10 minutes.');
      }
    }
  }

  private checkGroupSelection(roster: Partial<RostersEntity>) {
    if (roster.requireCategorySelection && roster.allowCategorySelection === false) {
      throw new BadRequestException('Turn on group picking before requiring it.');
    }
  }

  /** One roster per role: the bot gives and takes it by roster. */
  private async checkRoleFree(
    roleId: string,
    exceptId: ObjectId | null,
    opts: { closedToo: boolean },
  ) {
    const dup = await this.rosters.findOne(
      {
        roleId,
        ...(exceptId ? { _id: { $ne: exceptId } } : {}),
        ...(opts.closedToo ? {} : { closed: false }),
      },
      { projection: { _id: 1 } },
    );
    if (dup) throw new ConflictException('Another roster already uses this role.');
  }

  private async checkGroupName(guildId: string, name: string, exceptId?: ObjectId) {
    const dup = await this.groups.findOne({
      guildId,
      name: groupKey(name),
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    });
    if (dup) throw new ConflictException('A group with this name already exists.');
  }

  private async checkGroupRoleFree(guildId: string, roleId: string, exceptId?: ObjectId) {
    const dup = await this.groups.findOne({
      guildId,
      roleId,
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    });
    if (dup) throw new ConflictException('Another group already uses this role.');
  }

  /** The bot gives every server Confirmed and Substitute the first time it makes a roster. */
  private async createDefaultGroups(guildId: string) {
    if (await this.groups.findOne({ guildId }, { projection: { _id: 1 } })) return;
    const createdAt = new Date();
    await this.groups.insertMany([
      {
        _id: new ObjectId(),
        displayName: 'Confirmed',
        name: 'confirmed',
        order: 10,
        guildId,
        selectable: true,
        roleId: null,
        createdAt,
      },
      {
        _id: new ObjectId(),
        displayName: 'Substitute',
        name: 'substitute',
        order: 20,
        guildId,
        selectable: true,
        roleId: null,
        createdAt,
      },
    ]);
  }

  private async getDefaultSettings(guildId: string): Promise<DefaultSettings> {
    const settings = await this.db
      .collection(Collections.SETTINGS)
      .findOne({ guildId }, { projection: { rosterDefaultSettings: 1 } });
    return (
      (settings as { rosterDefaultSettings?: DefaultSettings } | null)?.rosterDefaultSettings ?? {}
    );
  }

  /** Like the bot, every create or edit becomes the server's starting point for the next roster. */
  private async setDefaultSettings(guildId: string, roster: Partial<RostersEntity>) {
    const settings: DefaultSettings = {
      allowMultiSignup: roster.allowMultiSignup,
      allowCategorySelection: roster.allowCategorySelection,
      requireCategorySelection: roster.requireCategorySelection,
      maxMembers: roster.maxMembers,
      minHeroLevels: roster.minHeroLevels,
      minTownHall: roster.minTownHall,
      maxTownHall: roster.maxTownHall,
      sortBy: roster.sortBy,
      allowUnlinked: roster.allowUnlinked,
      layout: roster.layout,
      colorCode: roster.colorCode,
      useClanAlias: roster.useClanAlias,
    };
    await this.db
      .collection(Collections.SETTINGS)
      .updateOne({ guildId }, { $set: { rosterDefaultSettings: settings } }, { upsert: true });
  }

  private async getGroup(guildId: string, groupId: string) {
    const group = ObjectId.isValid(groupId)
      ? await this.groups.findOne({ _id: new ObjectId(groupId), guildId })
      : null;
    if (group) return group;
    throw new NotFoundException('That group is not in this server.');
  }

  private get rosters() {
    return this.db.collection<RostersEntity>(Collections.ROSTERS);
  }

  private get groups() {
    return this.db.collection<RosterGroupsEntity>(Collections.ROSTER_GROUPS);
  }

  private get links() {
    return this.db.collection<PlayerLinksEntity>(Collections.PLAYER_LINKS);
  }
}
