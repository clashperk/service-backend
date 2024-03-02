import { CurrentUser, JwtAuthGuard, JwtUser } from '@app/auth';
import { getAppHealth } from '@app/helper';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.dto';

@ApiTags('AUTH')
@Controller('/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
  getStatus(@CurrentUser() user: JwtUser) {
    return user;
  }
}
