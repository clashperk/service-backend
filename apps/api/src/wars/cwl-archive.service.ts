import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIClanWar } from 'clashofclans.js';

const ARCHIVE_URL = 'https://archive.clashperk.com';

/**
 * The CWL archive the bot also reads: it keeps a season's wars after the game drops their war tags.
 * Sent the same internal key as this API (`API_KEY`).
 */
@Injectable()
export class CwlArchiveService {
  private readonly logger = new Logger(CwlArchiveService.name);
  private readonly apiKey: string;

  constructor(configService: ConfigService) {
    this.apiKey = configService.getOrThrow('API_KEY');
  }

  /**
   * The season's wars by war tag; empty when the archive doesn't have it or fails.
   * The archive keys seasons by month, so a group's "2026-09-02" is asked for as "2026-09".
   */
  async getSeasonWars(clanTag: string, season: string) {
    const month = season.slice(0, 7);
    try {
      // GET reads the archive's history; its POST re-fetches war tags from the game instead.
      const res = await fetch(
        `${ARCHIVE_URL}/clans/${encodeURIComponent(clanTag)}/cwl/seasons/${month}`,
        { headers: { 'x-api-key': this.apiKey }, signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) {
        this.logger.warn(`CWL archive returned ${res.status} for ${clanTag} ${month}`);
        return new Map<string, APIClanWar>();
      }
      const data = (await res.json()) as { wars?: (APIClanWar & { warTag: string })[] };
      return new Map((data.wars ?? []).map((war) => [war.warTag, war]));
    } catch (error) {
      this.logger.warn(`CWL archive failed for ${clanTag} ${month}: ${String(error)}`);
      return new Map<string, APIClanWar>();
    }
  }
}
