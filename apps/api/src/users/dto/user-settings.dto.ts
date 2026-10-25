import { IsString, Length, Matches } from 'class-validator';

export class ClanTagInput {
  @Matches(/^#?[0-9A-Za-z]{3,12}$/, { message: 'Enter a clan tag like #2PP.' })
  clanTag: string;
}

export class TimezoneInput {
  /** IANA ID, e.g. `Asia/Kolkata`. */
  @IsString()
  @Length(1, 64)
  id: string;
}

export class ClanRefDto {
  tag: string;
  name: string | null;
}

export class TimezoneDto {
  id: string;
  name: string;
  location: string;
}

export class UserSettingsDto {
  /** Used by bot commands run without a clan tag. */
  clan: ClanRefDto | null;
  /** Clans the user bookmarked on the dashboard, on every device. */
  bookmarks: ClanRefDto[];
  /** Used by /activity charts; null means UTC. */
  timezone: TimezoneDto | null;
}
