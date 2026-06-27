import { achievements, extraAchievements } from '@app/constants';

type GetDictValue<T extends string, O> = T extends keyof O ? O[T] : never;

export type AchievementsValues = GetDictValue<keyof typeof achievements, typeof achievements>;
export type ExtraAchievementsValues = GetDictValue<
  keyof typeof extraAchievements,
  typeof extraAchievements
>;

type AchievementsMap = { [key in AchievementsValues]: { initial: number; current: number } };

export interface PlayerSeasonEntity extends AchievementsMap {
  name: string;
  tag: string;
  season: string;
  townHallLevel: number;
  builderHallLevel: number;
  attackWins: number;
  defenseWins: number;
  warPreference?: string;
  versusTrophies: {
    initial: number;
    current: number;
  };
  versusBattleWins: {
    initial: number;
    current: number;
  };
  trophies: {
    initial: number;
    current: number;
  };
  clans: Record<
    string,
    {
      tag: string;
      name: string;
      donations: {
        current: number;
        total: number;
      };
      donationsReceived: {
        current: number;
        total: number;
      };
      createdTimestamp: number;
      updatedTimestamp: number;
    }
  >;
  __clans: string[];
  updatedAt: Date;
  createdAt: Date;
}
