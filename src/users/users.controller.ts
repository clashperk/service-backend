import { ApiExcludeRoute } from '@app/decorators';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { UsersService } from './users.service';

@Controller('/users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiExcludeRoute()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('/:userId')
  async getUser() {
    return Promise.resolve({ version: 'v1' });
  }
}
