import { CurrentUser, JwtAuthGuard, JwtUser } from '@app/auth';
import { getAppHealth } from '@app/helper';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get()
  ack() {
    return { message: `Hello from ${AuthController.name}` };
  }

  @Get('/health')
  stats() {
    return getAppHealth(AuthController.name);
  }

  @Post('/login')
  async login(@Body('password') password: string) {
    return this.authService.login(password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/status')
  getStatus(@CurrentUser() user: JwtUser) {
    return user;
  }
}
