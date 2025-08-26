import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { CacheControl } from './decorators';
import { LoginInputDto, LoginOkDto } from './dto';

@Controller('/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/login')
  async login(@Body() body: LoginInputDto): Promise<LoginOkDto> {
    const user = this.authService.login(body.token);
    return {
      roles: user.roles,
      userId: user.userId,
      accessToken: await this.authService.generateToken(),
    };
  }

  @Get('/generate-token')
  async generateToken() {
    return { accessToken: await this.authService.generateToken() };
  }

  @Get('/status')
  @CacheControl(30)
  async getAuthStatus(@Req() req: Request) {
    return Promise.resolve({
      'authorization': req.headers['authorization'] || null,
      'x-access-token': req.headers['x-access-token'] || null,
    });
  }
}
