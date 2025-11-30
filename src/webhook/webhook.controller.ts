import { Config } from '@app/constants';
import { ApiExcludeRoute } from '@app/decorators';
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
import { ApiExcludeController } from '@nestjs/swagger';
import { InteractionType } from 'discord-interactions';
import { WebhookService } from './webhook.service';

@Controller('/webhook')
@ApiExcludeRoute()
@ApiExcludeController(Config.IS_LOCAL)
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Post('/discord/interactions')
  @HttpCode(200)
  async handleDiscordInteractions(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, string | number>,
    @Headers('X-Signature-Ed25519') signature: string,
    @Headers('X-Signature-Timestamp') timestamp: string,
    @Query('message') message: string,
  ) {
    return this.webhookService.handleDiscordInteractions({
      rawBody: req.rawBody as Buffer,
      interactionType: body.type as InteractionType,
      message,
      signature,
      timestamp,
    });
  }

  @Post('/patreon/incoming')
  async handlePatreonWebhook() {}
}
