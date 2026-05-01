import { LegendRankingThresholdsSnapShotDto } from '../../tasks/dto';

export class LegendRankingThresholdsDto {
  live: LegendRankingThresholdsSnapShotDto;
  eod: LegendRankingThresholdsSnapShotDto | null;
  history: LegendRankingThresholdsSnapShotDto[];
}

export class LegendRankDto {
  tag: string;
  name: string;
  rank: number;
  trophies: number;
}

export class LeaderboardByTagsItemsDto {
  items: LegendRankDto[];
}
