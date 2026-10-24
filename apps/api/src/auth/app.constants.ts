/** Who a token is for, signed as its `aud` claim. Every token this service signs is for the API. */
export enum TokenAudience {
  DASHBOARD = 'dashboard',
  API = 'api',
}

/** Dashboard tokens signed before `aud` existed carry this version; accepted until audiences are required. */
export const LEGACY_DASHBOARD_VERSION = '1';

export enum AuthGuardStrategies {
  JWT = 'jwt',
}
