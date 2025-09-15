export const PRODUCTION_MODE = process.env.NODE_ENV === 'production';
export const CRONJOB_ENABLED = process.env.CRONJOB_ENABLED === '1';

export const SNOWFLAKE_REGEX = /^\d{17,19}/;

export const TAG_REGEX = /^#?[0289CGJLOPQRUVY]+$/i;
