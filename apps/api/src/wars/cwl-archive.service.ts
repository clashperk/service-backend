import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIClanWar } from 'clashofclans.js';
import { CWLGroupsEntity } from '../db';

const ARCHIVE_URL = 'https://clan-war-league-api-production.up.railway.app';

/**
 * The CWL archive the bot also reads: it keeps a season's wars after the game drops their war tags.
 * Authenticated with the same internal key as this API (`API_KEY`).
 */
@Injectable()
export class CwlArchiveService {
  private readonly logger = new Logger(CwlArchiveService.name);
  private readonly apiKey: string;

  constructor(configService: ConfigService) {
    this.apiKey = configService.getOrThrow('API_KEY');
  }

  /** The group's wars by war tag; empty when the archive doesn't have the season or fails. */
  async getSeasonWars(clanTag: string, group: CWLGroupsEntity) {
    try {
      const res = await fetch(
        `${ARCHIVE_URL}/clans/${encodeURIComponent(clanTag)}/cwl/seasons/${group.season}`,
        {
          method: 'POST',
          headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(group),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) {
        this.logger.warn(`CWL archive returned ${res.status} for ${clanTag} ${group.season}`);
        return new Map<string, APIClanWar>();
      }
      const data = (await res.json()) as { wars?: (APIClanWar & { warTag: string })[] };
      return new Map((data.wars ?? []).map((war) => [war.warTag, war]));
    } catch (error) {
      this.logger.warn(`CWL archive failed for ${clanTag} ${group.season}: ${String(error)}`);
      return new Map<string, APIClanWar>();
    }
  }
}
