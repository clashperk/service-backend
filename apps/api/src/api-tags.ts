export enum ApiTag {
  AUTH = 'Auth',
  PLAYERS = 'Players',
  CLANS = 'Clans',
  WARS = 'Wars',
  LEGENDS = 'Legends',
  RANKINGS = 'Rankings',
  LINKS = 'Links',
  EVENTS = 'Events',
  GUILDS = 'Guilds',
  ROSTERS = 'Rosters',
  USERS = 'Users',
  ADMIN = 'Admin',
  INTERNAL = 'Internal',
}

/** The order the docs list tags in. */
export const API_TAG_DESCRIPTIONS: Record<ApiTag, string> = {
  [ApiTag.AUTH]: 'Trade a passKey for an access token.',
  [ApiTag.PLAYERS]: 'Player profiles, battle logs, ranked weeks, seasons, wars and clan history.',
  [ApiTag.CLANS]: 'Clan details, member activity, links, capital raids and clan games.',
  [ApiTag.WARS]: 'Current and past wars, and Clan War Leagues.',
  [ApiTag.LEGENDS]: 'Legend League attacks, seasons and rank estimates.',
  [ApiTag.RANKINGS]:
    'Top 200 players and clans by country and worldwide: live, and saved at the end of each season.',
  [ApiTag.LINKS]: 'Links between player tags and Discord users.',
  [ApiTag.EVENTS]: 'Upcoming in-game events.',
  [ApiTag.GUILDS]:
    'Server settings: clans, logs, reminders, roles and tickets. Dashboard sessions only.',
  [ApiTag.ROSTERS]: 'Server rosters. Dashboard sessions only, unless a route names an API role.',
  [ApiTag.USERS]: 'The signed-in dashboard user. Dashboard sessions only.',
  [ApiTag.ADMIN]: 'Admin only.',
  [ApiTag.INTERNAL]: 'Called by our own services.',
};
