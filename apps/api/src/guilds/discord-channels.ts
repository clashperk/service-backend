import { DiscordRestService } from '@app/discord-rest';
import { APIChannel, ChannelType } from 'discord-api-types/v10';
import { ChannelStatus } from './dto';

export const POSTABLE_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
// Forum and media channels can't take messages, only their posts (threads) can.
export const THREAD_PARENTS = [
  ...POSTABLE_CHANNELS,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
];
export const THREADS = [
  ChannelType.AnnouncementThread,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
];

export type ChannelState = {
  name: string | null;
  parentName: string | null;
  status: ChannelStatus;
};
export type ChannelLookup = Awaited<ReturnType<DiscordRestService['findChannel']>>;

export const parentOf = (channel: APIChannel) =>
  'parent_id' in channel ? (channel.parent_id ?? null) : null;

export const byPosition = (a: APIChannel, b: APIChannel) =>
  ('position' in a ? a.position : 0) - ('position' in b ? b.position : 0);

/** A channel Discord returned, with its thread's parent from `channels` when it has one. */
export function describeChannel(
  channel: APIChannel,
  channels: Map<string, APIChannel>,
): ChannelState {
  const thread = 'thread_metadata' in channel ? channel.thread_metadata : undefined;
  const parentId = parentOf(channel);
  return {
    name: channel.name ?? null,
    parentName: thread && parentId ? (channels.get(parentId)?.name ?? null) : null,
    status: thread?.locked
      ? ChannelStatus.LOCKED
      : thread?.archived
        ? ChannelStatus.ARCHIVED
        : ChannelStatus.OK,
  };
}

/** A channel that isn't in the server: what its lookup said, or unknown when there was none. */
export function missingChannel(lookup: ChannelLookup | null | undefined): ChannelState {
  const status = !lookup
    ? ChannelStatus.UNKNOWN
    : 'missing' in lookup && lookup.missing === 'noAccess'
      ? ChannelStatus.NO_ACCESS
      : ChannelStatus.DELETED;
  return { name: null, parentName: null, status };
}
