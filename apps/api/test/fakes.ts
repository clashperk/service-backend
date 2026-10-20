import { Cache } from 'cache-manager';
import { ChannelState } from '../src/guilds/discord-channels';
import { ChannelStatus } from '../src/guilds/dto';

/** An in-memory stand-in for the cache-manager store. */
export function memoryCache(): Cache {
  const store = new Map<string, unknown>();
  return {
    get: (key: string) => Promise.resolve(store.get(key)),
    set: (key: string, value: unknown) => Promise.resolve(store.set(key, value) && value),
  } as unknown as Cache;
}

/** A channel as `GuildDiscordService.channelStatuses` describes it; deleted when unnamed. */
export const channelState = (name: string | null): ChannelState => ({
  name,
  parentName: null,
  status: name ? ChannelStatus.OK : ChannelStatus.DELETED,
});
