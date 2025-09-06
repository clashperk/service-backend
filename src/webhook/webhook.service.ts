import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { DiscordInteractionInput } from './dto';

@Injectable()
export class WebhookService {
  constructor(private configService: ConfigService) {}

  async handleDiscordInteractions({
    rawBody,
    interactionType,
    message,
    signature,
    timestamp,
  }: DiscordInteractionInput) {
    const discordPublicKey = this.configService.getOrThrow<string>('DISCORD_PUBLIC_KEY');

    const isValidRequest = await verifyKey(rawBody, signature, timestamp, discordPublicKey);
    if (!isValidRequest) return new UnauthorizedException();

    if (interactionType === InteractionType.PING) {
      return { type: InteractionResponseType.PONG };
    }

    if (interactionType === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
      return {
        type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
        data: {
          choices: [
            {
              name: message || 'The application is currently rebooting, please try again later.',
              value: '0',
            },
          ],
        },
      };
    }

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content:
          message ||
          'The application is currently rebooting, please try again later in a few minutes.',
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    };
  }
}
