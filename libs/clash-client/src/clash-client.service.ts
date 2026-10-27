import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APIClan,
  APIClanWarLeagueRound,
  APILeagueTier,
  APILocation,
  APIPlayer,
  getWarResult,
  SearchOptions,
} from 'clashofclans.js';
import moment from 'moment';
import { ClashClient } from './client';
import { ClanWarDto } from './dto/clan-wars.dto';

type AssetLeagueTier = {
  id: number;
  battle_count: number;
  promote_percentage: number | null;
  demote_percentage: number | null;
};

export type RankingsBoard =
  | 'players'
  | 'clans'
  | 'capital'
  | 'builder-base-players'
  | 'builder-base-clans';

export type LeagueTierRules = {
  /** Null for a tier without weekly battles (Unranked). */
  maxBattles: number | null;
  promotePercent: number;
  demotePercent: number;
};

/** Only a game API 404 means the tag doesn't exist; timeouts, maintenance and rate limits are worth a retry. */
const failure = (status: number, notFound: string) =>
  status === 404
    ? new NotFoundException(notFound)
    : new ServiceUnavailableException('The Clash of Clans API is unavailable. Try again shortly.');

@Injectable()
export class ClashClientService {
  constructor(
    private clashClient: ClashClient,
    private configService: ConfigService,
  ) {}

  /** Builds a dedicated, un-throttled ClashClient (rateLimit: 0). Used by apps/worker. */
  getClient() {
    const keyString = this.configService.getOrThrow('CLASH_API_TOKENS');
    const keys = keyString.length ? keyString.split(',') : [];
    return new ClashClient({
      keys,
      rateLimit: 0,
      baseURL: this.configService.get('CLASH_API_BASE_URL'),
    });
  }

  async getClan(clanTag: string) {
    const { body, res } = await this.clashClient.getClan(clanTag);
    if (!res.ok) return null;

    return body;
  }

  async getPlayer(playerTag: string) {
    const { body, res } = await this.clashClient.getPlayer(playerTag);
    if (!res.ok) return null;

    return body;
  }

  public async getPlayers(playerTags: string[]) {
    const result = await Promise.all(playerTags.map((tag) => this.getPlayer(tag)));
    return result.filter((body): body is APIPlayer => !!body);
  }

  public async getClans(clanTags: string[]) {
    const result = await Promise.all(clanTags.map((tag) => this.getClan(tag)));
    return result.filter((body): body is APIClan => !!body);
  }

  async getSeasonRankings(seasonId: string, opts: SearchOptions) {
    return this.clashClient.getSeasonRankings(29000022, seasonId, opts);
  }

  async getClanOrThrow(clanTag: string) {
    const { body, res } = await this.clashClient.getClan(clanTag);
    if (!res.ok) throw failure(res.status, `Clan ${clanTag} not found.`);

    return body;
  }

  async getPlayerOrThrow(playerTag: string) {
    const { body, res } = await this.clashClient.getPlayer(playerTag);
    if (!res.ok) throw failure(res.status, `Player ${playerTag} not found.`);

    return body;
  }

  /** `isWarLogPublic` is false when the API answers 403 (private war log). */
  async getCurrentWar(clanTag: string) {
    const { body, res } = await this.clashClient.getCurrentWar(clanTag);
    return { body: res.ok ? body : null, isWarLogPublic: res.status !== 403 };
  }

  async getClanWarLeagueGroup(clanTag: string) {
    const { body, res } = await this.clashClient.getClanWarLeagueGroup(clanTag);
    if (!res.ok || body.state === 'notInWar') return null;

    return body;
  }

  private leagueNames: Promise<Map<number, string>> | null = null;

  /** War and capital league names by id; fetched once, since Supercell rarely changes them. */
  getLeagueNames() {
    this.leagueNames ??= Promise.all([
      this.clashClient.getWarLeagues(),
      this.clashClient.getCapitalLeagues(),
    ])
      .then((lists) => {
        const names = new Map<number, string>();
        for (const { res, body } of lists) {
          if (!res.ok) throw new Error('League list unavailable');
          for (const league of body.items) names.set(league.id, league.name);
        }
        return names;
      })
      .catch((error: Error) => {
        this.leagueNames = null;
        throw error;
      });
    return this.leagueNames;
  }

  /** The weekly ranked group a player is in, with their own battles; null when they have none. */
  async getLeagueGroup(groupTag: string, seasonId: number, playerTag: string) {
    const { body, res } = await this.clashClient.getLeagueGroup(groupTag, seasonId, {
      playerTag,
    });
    return res.ok && body.members?.length ? body : null;
  }

  /** A player's results in past ranked weeks, oldest first. */
  async getLeagueHistory(playerTag: string) {
    const { body, res } = await this.clashClient.getLeagueHistory(playerTag);
    return res.ok ? body.items : [];
  }

  private countries: Promise<APILocation[]> | null = null;

  /** The countries the game ranks players and clans in; fetched once. */
  getCountries() {
    this.countries ??= this.clashClient
      .getLocations()
      .then(({ res, body }) => {
        if (!res.ok) throw new Error('Locations unavailable');
        return body.items.filter((location) => location.isCountry && location.countryCode);
      })
      .catch((error: Error) => {
        this.countries = null;
        throw error;
      });
    return this.countries;
  }

  /** A location's live top 200 on one board; `global` for worldwide. */
  async getRankings(locationId: number | 'global', board: RankingsBoard) {
    const request = {
      'players': () => this.clashClient.getPlayerRanks(locationId),
      'clans': () => this.clashClient.getClanRanks(locationId),
      'capital': () => this.clashClient.getClanCapitalRanks(locationId),
      'builder-base-players': () => this.clashClient.getBuilderBasePlayerRanks(locationId),
      'builder-base-clans': () => this.clashClient.getBuilderBaseClanRanks(locationId),
    }[board];
    const { res, body } = await request();
    if (!res.ok) throw failure(res.status, 'Location not found.');
    return body.items;
  }

  private leagueTiers: Promise<Map<number, APILeagueTier>> | null = null;

  /** Ranked league tiers by id; fetched once, like the other league lists. */
  getLeagueTiers() {
    this.leagueTiers ??= this.clashClient
      .getLeagueTiers()
      .then(({ res, body }) => {
        if (!res.ok) throw new Error('League tiers unavailable');
        return new Map(body.items.map((tier) => [tier.id, tier]));
      })
      .catch((error: Error) => {
        this.leagueTiers = null;
        throw error;
      });
    return this.leagueTiers;
  }

  private leagueTierRules: Promise<Map<number, LeagueTierRules>> | null = null;

  /** Each ranked tier's weekly battles and zone percents, from the game data on the asset CDN. */
  getLeagueTierRules() {
    this.leagueTierRules ??= fetch('https://assets.clashperk.com/raw.min.json')
      .then(async (res) => {
        if (!res.ok) throw new Error('Game data unavailable');
        const { league_tiers } = (await res.json()) as { league_tiers: AssetLeagueTier[] };
        return new Map(
          league_tiers.map((tier) => [
            tier.id,
            {
              maxBattles: tier.battle_count || null,
              promotePercent: tier.promote_percentage ?? 0,
              demotePercent: tier.demote_percentage ?? 0,
            },
          ]),
        );
      })
      .catch((error: Error) => {
        this.leagueTierRules = null;
        throw error;
      });
    return this.leagueTierRules;
  }

  async verifyPlayerOrThrow(playerTag: string, apiToken: string | null) {
    if (!apiToken) return false;

    const { body, res } = await this.clashClient.verifyPlayerToken(playerTag, apiToken);
    if (!res.ok) throw failure(res.status, `Player ${playerTag} could not be verified.`);

    const isVerified = body.status === 'ok';
    if (!isVerified) throw new NotFoundException(`Player ${playerTag} could not be verified.`);

    return isVerified;
  }

  async getClanWarLeague(clanTag: string) {
    const { body, res } = await this.clashClient.getClanWarLeagueGroup(clanTag);
    if (!res.ok) throw failure(res.status, `Clan ${clanTag} is not in CWL.`);
    if (body.state === 'notInWar') throw new NotFoundException(`Clan ${clanTag} is not in CWL.`);

    const rounds = body.rounds.filter((round) => !round.warTags.includes('#0'));
    const warTags = rounds.map((round) => round.warTags).flat();
    const result = await Promise.all(
      warTags.map((warTag) => this.getLeagueRoundWithWarTag(warTag)),
    );

    const payload: {
      season: string;
      rounds: APIClanWarLeagueRound[];
      clans: { tag: string; name: string; leagueId: number }[];
      wars: ClanWarDto[];
    } = {
      season: body.season,
      clans: body.clans.map((clan) => ({
        tag: clan.tag,
        name: clan.name,
        leagueId: 0,
      })),
      rounds,
      wars: [],
    };

    for (const { body, warTag } of result) {
      if (!body) continue;
      const round = rounds.findIndex(({ warTags }) => warTags.includes(warTag)) + 1;
      const clan = body.clan.tag === clanTag ? body.clan : body.opponent;
      const opponent = body.clan.tag === clan.tag ? body.opponent : body.clan;
      payload.wars.push({
        ...body,
        startTime: moment(body.startTime).toDate(),
        preparationStartTime: moment(body.preparationStartTime).toDate(),
        endTime: moment(body.endTime).toDate(),
        clan,
        opponent,
        round,
        warTag,
        result: getWarResult(clan, opponent),
      });
    }

    return payload;
  }

  public async getLeagueRoundWithWarTag(warTag: string) {
    const { res, body } = await this.clashClient.getClanWarLeagueRound(warTag);
    if (!res.ok || body.state === 'notInWar') return { body: null, warTag };
    return { body, warTag };
  }
}
