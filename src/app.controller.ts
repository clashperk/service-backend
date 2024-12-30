import { ClashClientService } from '@app/clash-client';
import { Collections } from '@app/constants';
import { DiscordOAuthService } from '@app/discord-oauth';
import { PlayerLinksEntity, SettingsEntity } from '@app/entities';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { Request, Response } from 'express';
import { Collection } from 'mongodb';

@ApiTags('DISCORD')
@Controller({ path: '/' })
export class AppController {
  private readonly discordPublicKey: string;
  constructor(
    private configService: ConfigService,
    private discordOAuthService: DiscordOAuthService,
    @Inject(Collections.PLAYER_LINKS)
    private playerLinksEntity: Collection<PlayerLinksEntity>,
    @Inject(Collections.SETTINGS) private settingsRepository: Collection<SettingsEntity>,
    private clashClientService: ClashClientService,
  ) {
    this.discordPublicKey = this.configService.getOrThrow<string>('DISCORD_PUBLIC_KEY');
  }

  @Post('/interactions')
  @HttpCode(200)
  handleDiscordInteractions(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, string | number>,
    @Headers('X-Signature-Ed25519') signature: string,
    @Headers('X-Signature-Timestamp') timestamp: string,
    @Query('message') message: string,
  ) {
    const isValidRequest = verifyKey(
      req.rawBody as Buffer,
      signature,
      timestamp,
      this.discordPublicKey,
    );
    if (!isValidRequest) return new UnauthorizedException();

    if (body.type === InteractionType.PING) {
      return { type: InteractionResponseType.PONG };
    }

    if (body.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
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

  @Get('/connect')
  connect(@Res() res: Response) {
    const { state, url } = this.discordOAuthService.getOAuth2Url();

    // Store the signed state param in the user's cookies so we can verify the value later
    // https://this.discordOAuthService.com/developers/docs/topics/oauth2#state-and-security
    res.cookie('clientState', state, { maxAge: 1000 * 60 * 5, signed: true });

    return res.redirect(url);
  }

  @Get('/authorize-emoji-servers')
  authorizeEmojiServers(@Res() res: Response) {
    const { state, url } = this.discordOAuthService.getOAuth2Url(true);

    // Store the signed state param in the user's cookies so we can verify the value later
    // https://this.discordOAuthService.com/developers/docs/topics/oauth2#state-and-security
    res.cookie('clientState', state, { maxAge: 1000 * 60 * 5, signed: true });

    return res.redirect(url);
  }

  @Get('/discord-oauth-callback')
  async onCallback(@Req() req: Request, @Res() res: Response) {
    try {
      // 1. Uses the code and state to acquire Discord OAuth2 tokens
      const code = req.query['code'];
      const discordState = req.query['state'];

      // Make sure the state parameter exists
      const { clientState } = req.signedCookies;
      if (clientState !== discordState) {
        return res.status(403).json({ message: 'State verification failed.' });
      }

      if (discordState?.toString().startsWith('guilds.join')) {
        await this.joinEmojiServers(code as string);
      } else {
        await this.connectLinkedRoles(code as string);
      }

      return res.send('<h1>You did it!  Now go back to Discord.</h1>');
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException();
    }
  }

  private async connectLinkedRoles(code: string) {
    const tokens = await this.discordOAuthService.getOAuthTokens(code);
    const meData = await this.discordOAuthService.getUserData(tokens);
    const userId = meData.user.id;
    await this.discordOAuthService.storeDiscordTokens(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    });

    const link = await this.playerLinksEntity.findOne({ userId }, { sort: { order: 1 } });
    const player = link ? await this.clashClientService.getPlayer(link.tag) : null;
    if (!player) throw new NotFoundException('No linked player found.');

    const metadata = {
      trophies: player.trophies,
      verified: link?.verified ? 1 : 0,
      username: `${player.name} (${player.tag})`,
    };

    // 3. Update the users metadata, assuming future updates will be posted to the `/update-metadata` endpoint
    await this.discordOAuthService.pushMetadata(userId, metadata, tokens);
  }

  private async joinEmojiServers(code: string) {
    const tokens = await this.discordOAuthService.getOAuthTokens(code);
    const meData = await this.discordOAuthService.getUserData(tokens);
    const userId = meData.user.id;
    await this.discordOAuthService.storeDiscordTokens(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    });

    const setting = await this.settingsRepository.findOne({ guildId: 'global' });
    const guildIds = (setting?.emojiServers || []) as string[];

    for (const guildId of guildIds) {
      await this.discordOAuthService.joinGuild(userId, guildId, tokens);
    }
  }
}
