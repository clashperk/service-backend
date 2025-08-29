import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GenerateTokenDto, GenerateTokenInputDto, LoginInputDto, LoginOkDto } from './dto';
import { ApiKeyGuard } from './guards';

@Controller('/auth')
@UseGuards(ApiKeyGuard)
@ApiSecurity('apiKey')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({
    summary: `Authenticates a user and returns login information.`,
  })
  @Post('/login')
  async login(@Body() body: LoginInputDto): Promise<LoginOkDto> {
    return this.authService.login(body.userId);
  }

  @ApiOperation({
    summary: `Generates a JWT token with specified user roles.`,
  })
  @Post('/generate-token')
  async generateToken(@Body() body: GenerateTokenInputDto): Promise<GenerateTokenDto> {
    return this.authService.generateToken(body);
  }
}
