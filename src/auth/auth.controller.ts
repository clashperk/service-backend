import { ApiExcludeRoute, ApiKeyAuth } from '@app/decorators';
import { paragraph } from '@app/helpers';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  AuthUserDto,
  GenerateTokenDto,
  GenerateTokenInputDto,
  HandoffTokenInputDto,
  HandoffUserDto,
  LoginInputDto,
  LoginOkDto,
} from './dto';
import { ApiKeyGuard } from './guards';

@Controller('/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /** Authenticate with your passKey to receive an accessToken required for authorized API requests. */
  @Post('/login')
  @ApiOperation({
    description: paragraph(
      'Authenticates a user using a `passKey` and returns an `accessToken` with a limited validity period (2 hours). Once the token expires, a new token must be generated.',
      '',
      'The `accessToken` must be included in all protected API requests using the following header `Authorization: Bearer <accessToken>`',
    ),
  })
  async login(@Body() body: LoginInputDto): Promise<LoginOkDto> {
    return this.authService.login(body.passKey);
  }

  /** Generates a JWT token with specified user roles. */
  @UseGuards(ApiKeyGuard)
  @ApiExcludeRoute()
  @Post('/generate-token')
  @ApiKeyAuth()
  async generateToken(@Body() body: GenerateTokenInputDto): Promise<GenerateTokenDto> {
    return this.authService.generateToken(body);
  }

  /** Retrieves authenticated user information based on userId. */
  @Get('/users/:userId')
  @UseGuards(ApiKeyGuard)
  @ApiExcludeRoute()
  @ApiKeyAuth()
  async getAuthUser(@Param('userId') userId: string): Promise<AuthUserDto> {
    return this.authService.getAuthUser(userId);
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
  async createHandoffToken(@Body() body: HandoffTokenInputDto) {
    return this.authService.createHandoffToken(body);
  }
}
