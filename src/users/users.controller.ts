import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { UsersService } from './users.service';

@Controller('/users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('/:userId')
  @Version('1')
  async getUser() {
    return Promise.resolve({ version: 'v1' });
  }

  @Get('/:userId')
  @Version('2')
  async _getUser() {
    return Promise.resolve({ version: 'v2' });
  }
}
