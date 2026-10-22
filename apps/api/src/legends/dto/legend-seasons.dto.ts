import { IsOptional, Matches } from 'class-validator';

export class LegendSeasonInputDto {
  /**
   * The league season's start date; the current season when left out. A legacy `YYYY-MM` id is
   * still accepted.
   * @example "2026-10-05"
   */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}(-\d{2})?$/, { message: 'seasonId must be in YYYY-MM-DD format' })
  seasonId?: string;
}

export class LegendSeasonDto {
  seasonId: string;
  /** Trophies when the season's first attack or defense was tracked. */
  initial: number;
  /** Trophies after the season's last tracked attack or defense. */
  trophies: number;
  /**
   * Trophies gained from attacks. Several attacks between two checks land as one log entry, so
   * attacks are only totalled, not counted.
   */
  attackTrophies: number;
  /** Trophies lost to defenses, as a negative number. */
  defenseTrophies: number;
}

export class LegendSeasonsDto {
  /** Newest first, at most 6. */
  items: LegendSeasonDto[];
}
