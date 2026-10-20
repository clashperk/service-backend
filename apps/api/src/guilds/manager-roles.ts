/** Settings keys `/config` stores manager roles under; `managerRole` grants every command. */
export const MANAGER_ROLE_KEYS = {
  managerRoles: 'managerRole',
  rosterManagerRoles: 'rosterManagerRole',
  flagsManagerRoles: 'flagsManagerRole',
  linksManagerRoles: 'linksManagerRole',
} as const;

/** Older bot versions saved a single role ID instead of a list. */
export const toRoleIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string')
    : typeof value === 'string' && value
      ? [value]
      : [];
