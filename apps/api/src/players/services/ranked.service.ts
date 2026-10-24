import { ClashClientService, LeagueTierRules } from '@app/clash-client';
import { Injectable } from '@nestjs/common';
import { APILeagueGroupList, APILeagueTier } from 'clashofclans.js';
import { RankedBattleDto, RankedDto, RankedLeagueDto } from '../dto';

const WEEK = 7 * 24 * 60 * 60 * 1000;

type Log = APILeagueGroupList['attackLogs'][number];

@Injectable()
export class RankedService {
  constructor(private clashClientService: ClashClientService) {}

  /** The player's ranked week so far and their past weeks, as the bot's ranked view shows them. */
  async getRanked(playerTag: string): Promise<RankedDto> {
    const player = await this.clashClientService.getPlayerOrThrow(playerTag);
    const [group, history, tiers, rules] = await Promise.all([
      player.currentLeagueGroupTag
        ? this.clashClientService.getLeagueGroup(
            player.currentLeagueGroupTag,
            player.currentLeagueSeasonId,
            player.tag,
          )
        : null,
      this.clashClientService.getLeagueHistory(player.tag),
      this.clashClientService.getLeagueTiers().catch(() => new Map<number, APILeagueTier>()),
      this.clashClientService.getLeagueTierRules().catch(() => new Map<number, LeagueTierRules>()),
    ]);

    const league = (id: number): RankedLeagueDto => {
      const tier = tiers.get(id);
      return { id, name: tier?.name ?? 'Unknown league', iconUrl: tier?.iconUrls.large ?? null };
    };

    return {
      current: group
        ? this.toWeek(group, player, league(player.leagueTier.id), rules.get(player.leagueTier.id))
        : null,
      history: history
        .map((week) => ({
          league: league(week.leagueTierId),
          startTime: new Date(week.leagueSeasonId * 1000),
          placement: week.placement,
          trophies: week.leagueTrophies,
          attackWins: week.attackWins,
          attackLosses: week.attackLosses,
          defenseWins: week.defenseWins,
          defenseLosses: week.defenseLosses,
          defenseStars: week.defenseStars,
          maxBattles: week.maxBattles,
        }))
        .reverse(),
    };
  }

  private toWeek(
    group: APILeagueGroupList,
    player: { tag: string; currentLeagueSeasonId: number; leagueTier: { id: number } },
    league: RankedLeagueDto,
    rules: LeagueTierRules | undefined,
  ) {
    const total = group.members.length;
    const rank = group.members.findIndex((m) => m.playerTag === player.tag) + 1;
    const me = group.members[rank - 1];
    const startTime = new Date(player.currentLeagueSeasonId * 1000);

    return {
      league,
      startTime,
      endTime: new Date(startTime.getTime() + WEEK),
      rank,
      total,
      promotionZone: rules ? Math.ceil((total * rules.promotePercent) / 100) : 0,
      demotionZone: rules ? Math.ceil((total * rules.demotePercent) / 100) : 0,
      trophies: me?.leagueTrophies ?? 0,
      maxBattles: rules?.maxBattles ?? null,
      attackWins: me?.attackWinCount ?? 0,
      attackLosses: me?.attackLoseCount ?? 0,
      defenseWins: me?.defenseWinCount ?? 0,
      defenseLosses: me?.defenseLoseCount ?? 0,
      members: group.members.map((m, i) => ({
        rank: i + 1,
        tag: m.playerTag,
        name: m.playerName,
        clan: m.clanTag ? { tag: m.clanTag, name: m.clanName } : null,
        trophies: m.leagueTrophies,
        attackWins: m.attackWinCount,
        attackLosses: m.attackLoseCount,
        defenseWins: m.defenseWinCount,
        defenseLosses: m.defenseLoseCount,
      })),
      attacks: this.toBattles(group.attackLogs),
      defenses: this.toBattles(group.defenseLogs),
    };
  }

  private toBattles(logs: Log[]): RankedBattleDto[] {
    return logs
      .map((log) => ({
        opponent: { tag: log.opponentPlayerTag, name: log.opponentName },
        stars: log.stars,
        destruction: log.destructionPercentage,
        trophies: log.trophies,
        createdAt: new Date(log.creationTime),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
