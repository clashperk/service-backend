import { ApiExcludeRoute, ApiExcludeTypings } from '@app/decorators';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InteractionType } from 'discord-interactions';
import { MessageOkDto } from '../links/dto';
import { WebhookService } from './webhook.service';
import { ApiTag } from '../api-tags';

@ApiTags(ApiTag.INTERNAL)
@Controller('/webhook')
@ApiExcludeRoute()
@ApiExcludeTypings()
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Post('/discord/interactions/incoming')
  @HttpCode(200)
  handleDiscordInteractions(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, string | number>,
    @Headers('X-Signature-Ed25519') signature: string,
    @Headers('X-Signature-Timestamp') timestamp: string,
    @Query('message') message: string,
  ): Promise<MessageOkDto> {
    return this.webhookService.handleDiscordInteractions({
      rawBody: req.rawBody as Buffer,
      interactionType: body.type as InteractionType,
      message,
      signature,
      timestamp,
    });
  }

  @Post('/patreon/incoming')
  handlePatreonWebhook(): Promise<MessageOkDto> {
    return Promise.resolve({ message: 'Ok' });
  }
}
