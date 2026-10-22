import { ClashClientService } from '@app/clash-client';
import { Injectable } from '@nestjs/common';
import { APILeagueGroupList, APILeagueTier } from 'clashofclans.js';
import { RankedBattleDto, RankedDto, RankedLeagueDto } from '../dto';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Percent of a group that moves up and down a league each week, by league tier id (as the bot). */
const ZONES: Record<number, { promotion: number; demotion: number }> = {
  105000000: { promotion: 50, demotion: 0 },
  105000001: { promotion: 50, demotion: 0 },
  105000002: { promotion: 50, demotion: 10 },
  105000003: { promotion: 50, demotion: 10 },
  105000004: { promotion: 40, demotion: 10 },
  ...Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [105000005 + i, { promotion: 30, demotion: 10 }]),
  ),
  ...Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [105000011 + i, { promotion: 30, demotion: 15 }]),
  ),
  ...Object.fromEntries(
    Array.from({ length: 4 }, (_, i) => [105000020 + i, { promotion: 25, demotion: 20 }]),
  ),
  ...Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [105000024 + i, { promotion: 20, demotion: 20 }]),
  ),
  105000032: { promotion: 15, demotion: 15 },
  105000033: { promotion: 15, demotion: 15 },
  105000034: { promotion: 5, demotion: 15 },
  105000035: { promotion: 3, demotion: 15 },
};

type Log = APILeagueGroupList['attackLogs'][number];

@Injectable()
export class RankedService {
  constructor(private clashClientService: ClashClientService) {}

  /** The player's ranked week so far and their past weeks, as the bot's ranked view shows them. */
  async getRanked(playerTag: string): Promise<RankedDto> {
    const player = await this.clashClientService.getPlayerOrThrow(playerTag);
    const [group, history, tiers] = await Promise.all([
      player.currentLeagueGroupTag
        ? this.clashClientService.getLeagueGroup(
            player.currentLeagueGroupTag,
            player.currentLeagueSeasonId,
            player.tag,
          )
        : null,
      this.clashClientService.getLeagueHistory(player.tag),
      this.clashClientService.getLeagueTiers().catch(() => new Map<number, APILeagueTier>()),
    ]);

    const league = (id: number): RankedLeagueDto => {
      const tier = tiers.get(id);
      return { id, name: tier?.name ?? 'Unknown league', iconUrl: tier?.iconUrls.large ?? null };
    };

    return {
      current: group ? this.toWeek(group, player, league(player.leagueTier.id)) : null,
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
  ) {
    const total = group.members.length;
    const rank = group.members.findIndex((m) => m.playerTag === player.tag) + 1;
    const me = group.members[rank - 1];
    const zones = ZONES[player.leagueTier.id];
    const startTime = new Date(player.currentLeagueSeasonId * 1000);

    return {
      league,
      startTime,
      endTime: new Date(startTime.getTime() + WEEK),
      rank,
      total,
      promotionZone: zones ? Math.ceil((total * zones.promotion) / 100) : 0,
      demotionZone: zones ? Math.ceil((total * zones.demotion) / 100) : 0,
      trophies: me?.leagueTrophies ?? 0,
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
