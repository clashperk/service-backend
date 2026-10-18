import {
  APIChatLanguage,
  APIIcon,
  APILabel,
  APILeagueTier,
  APILeagueTierIcon,
  APILocation,
  APIPlayerHouse,
} from 'clashofclans.js';

export class IconUrlsDto implements APIIcon {
  small: string;
  tiny?: string;
  medium?: string;
}

export class LabelDto implements APILabel {
  id: number;
  name: string;
  iconUrls: IconUrlsDto;
}

export class LeagueTierIconUrlsDto implements APILeagueTierIcon {
  small: string;
  large: string;
}

export class LeagueTierDto implements APILeagueTier {
  id: number;
  name: string;
  iconUrls: LeagueTierIconUrlsDto;
}

export class NamedLeagueDto {
  id: number;
  name: string;
}

export class LocationDto implements APILocation {
  localizedName?: string;
  id: number;
  name: string;
  isCountry: boolean;
  countryCode?: string;
}

export class ChatLanguageDto implements APIChatLanguage {
  name: string;
  id: number;
  languageCode: string;
}

export class PlayerHouseElementDto {
  type: string;
  id: number;
}

export class PlayerHouseDto implements APIPlayerHouse {
  elements: PlayerHouseElementDto[];
}
