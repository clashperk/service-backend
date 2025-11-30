import { ApiExcludeRoute, ApiKeyAuth } from '@app/decorators';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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
