export const Config = {
  IS_PROD: process.env.NODE_ENV === 'production',
  ALLOWED_DOMAINS: [
    'https://clashperk.com',
    'https://api.clashperk.com',
    'https://app.clashperk.com',
    'https://dash.clashperk.com',
    'https://docs.clashperk.com',
    'https://dashboard.clashperk.com',
    'https://staging.clashperk.com',
  ] as const,
  CRON_ENABLED: process.env.CRONJOB_ENABLED === '1',
};

export const SNOWFLAKE_REGEX = /^\d{17,19}/;

export const TAG_REGEX = /^#?[0289CGJLOPQRUVY]+$/i;
