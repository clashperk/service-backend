import { InteractionType } from 'discord-interactions';

export class DiscordInteractionInput {
  rawBody: Buffer;
  interactionType: InteractionType;
  signature: string;
  timestamp: string;
  message: string;
}
