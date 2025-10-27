import { Config } from '@app/constants';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiSecurity } from '@nestjs/swagger';
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

  /** Authenticates a user and returns login information. */
  @Post('/login')
  async login(@Body() body: LoginInputDto): Promise<LoginOkDto> {
    return this.authService.login(body.passKey);
  }

  /** Generates a JWT token with specified user roles. */
  @UseGuards(ApiKeyGuard)
  @Post('/generate-token')
  @ApiSecurity('apiKey')
  async generateToken(@Body() body: GenerateTokenInputDto): Promise<GenerateTokenDto> {
    return this.authService.generateToken(body);
  }

  /** Retrieves authenticated user information based on userId. */
  @Get('/users/:userId')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('apiKey')
  async getAuthUser(@Param('userId') userId: string): Promise<AuthUserDto> {
    return this.authService.getAuthUser(userId);
  }

  @Get('/handoff/:token')
  @UseGuards(ApiKeyGuard)
  @ApiExcludeEndpoint(Config.IS_PROD)
  @ApiSecurity('apiKey')
  async decodeHandoffToken(@Param('token') token: string): Promise<HandoffUserDto> {
    return this.authService.decodeHandoffToken(token);
  }

  @Post('/handoff')
  @ApiExcludeEndpoint(Config.IS_PROD)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('apiKey')
  async createHandoffToken(@Body() body: HandoffTokenInputDto) {
    return this.authService.createHandoffToken(body);
  }
}
