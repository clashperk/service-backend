import { ApiExcludeRoute, ApiKeyAuth } from '@app/decorators';
import { paragraph } from '@app/helpers';
import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  AuthUserDto,
  GenerateTokenDto,
  GenerateTokenInputDto,
  HandoffTokenDto,
  HandoffTokenInputDto,
  HandoffUserDto,
  LoginInputDto,
  LoginOkDto,
  TurnstileLoginDto,
} from './dto';
import { ApiKeyGuard } from './guards';

@Controller('/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/login')
  @ApiOperation({
    summary:
      'Authenticate with your passKey to receive an accessToken required for authorized API requests.',
    description: paragraph(
      'Authenticates a user using a `passKey` and returns an `accessToken` with a limited validity period (2 hours). Once the token expires, a new token must be generated.',
      '',
      'The `accessToken` must be included in all protected API requests using the following header `Authorization: Bearer <accessToken>`',
    ),
  })
  async login(@Body() body: LoginInputDto): Promise<LoginOkDto> {
    return this.authService.login(body.passKey);
  }

  @ApiOperation({ summary: 'Generate a passKey required for authentication.' })
  @UseGuards(ApiKeyGuard)
  @Post('/generate-passkey')
  @ApiKeyAuth()
  async generatePasskey(@Body() body: GenerateTokenInputDto): Promise<GenerateTokenDto> {
    return this.authService.generateToken(body);
  }

  @Get('/users/:userId')
  @UseGuards(ApiKeyGuard)
  @ApiExcludeRoute()
  @ApiKeyAuth()
  async getAuthUser(@Param('userId') userId: string): Promise<AuthUserDto> {
    return this.authService.getAuthUser(userId);
  }

  @Post('/turnstile')
  @ApiExcludeEndpoint()
  async loginWithTurnstile(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: TurnstileLoginDto,
  ): Promise<LoginOkDto> {
    const remoteIp = (req.headers['cf-connecting-ip'] || req.ip) as string;
    const result = await this.authService.loginWithTurnstile(body.token, remoteIp);

    res.cookie('cf.turnstile.auth', remoteIp, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      signed: true,
      maxAge: 5 * 60 * 60 * 1000,
    });

    return res.json(result) as unknown as LoginOkDto;
  }

  @Get('/handoff/:token')
  @UseGuards(ApiKeyGuard)
  @ApiExcludeRoute()
  @ApiKeyAuth()
  async decodeHandoffToken(@Param('token') token: string): Promise<HandoffUserDto> {
    return this.authService.decodeHandoffToken(token);
  }

  @Post('/handoff')
  @ApiExcludeRoute()
  @UseGuards(ApiKeyGuard)
  @ApiKeyAuth()
  async createHandoffToken(@Body() body: HandoffTokenInputDto): Promise<HandoffTokenDto> {
    return this.authService.createHandoffToken(body);
  }
}
