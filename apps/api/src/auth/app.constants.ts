/** The dashboard signs its users' tokens with this version; `/auth/login` and `/auth/turnstile` use 'v2'. */
export const DASHBOARD_TOKEN_VERSION = '1';

export enum AuthGuardStrategies {
  JWT = 'jwt',
}
