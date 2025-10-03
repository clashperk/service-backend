export class ThresholdsDto {
  rank: number;
  minTrophies: number;
}

export class LegendRankingThresholdsSnapShotDto {
  timestamp: string;
  thresholds: ThresholdsDto[];
}
