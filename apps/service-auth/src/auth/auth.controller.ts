import { CurrentUserExpanded, JwtAuthGuard, JwtUser, Role, Roles, RolesGuard } from '@app/auth';
import { getAppHealth } from '@app/helper';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginInput } from './dto';

@ApiTags('AUTH')
@Controller({ path: '/auth' })
export class AuthController {
  private readonly discordPublicKey: string;
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    this.discordPublicKey = this.configService.getOrThrow<string>('DISCORD_PUBLIC_KEY');
  }

  @ApiExcludeEndpoint()
  @Get()
  ack() {
    return { message: `Hello from ${AuthController.name}` };
  }

  @ApiExcludeEndpoint()
  @Get('/health')
  stats() {
    return getAppHealth(AuthController.name);
  }

  @Post('/login')
  async login(@Body() body: LoginInput) {
    return this.authService.login(body.passkey);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('/status')
  getStatus(@CurrentUserExpanded() user: JwtUser) {
    return user;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiExcludeEndpoint()
  @Get('/applications')
  getCustomBots() {
    return this.authService.getCustomBots();
  }

  @Post('/interactions')
  @HttpCode(200)
  handleInteractions(
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
}
