/** Dashboard tokens signed before `aud` existed carry this version; accepted until audiences are required. */
export const LEGACY_DASHBOARD_VERSION = '1';

export enum AuthGuardStrategies {
  JWT = 'jwt',
}
