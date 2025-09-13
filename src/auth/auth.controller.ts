import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  AuthUserDto,
  GenerateTokenDto,
  GenerateTokenInputDto,
  LoginInputDto,
  LoginOkDto,
} from './dto';
import { ApiKeyGuard } from './guards';

@Controller('/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({
    summary: `Authenticates a user and returns login information.`,
  })
  @Post('/login')
  async login(@Body() body: LoginInputDto): Promise<LoginOkDto> {
    return this.authService.login(body.passKey);
  }

  @ApiOperation({
    summary: `Generates a JWT token with specified user roles.`,
  })
  @UseGuards(ApiKeyGuard)
  @Post('/generate-token')
  @ApiSecurity('apiKey')
  async generateToken(@Body() body: GenerateTokenInputDto): Promise<GenerateTokenDto> {
    return this.authService.generateToken(body);
  }

  @ApiOperation({
    summary: `Retrieves authenticated user information based on userId.`,
  })
  @Get('/users/:userId')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('apiKey')
  async getAuthUser(@Param('userId') userId: string): Promise<AuthUserDto> {
    return this.authService.getAuthUser(userId);
  }
}
