import { PRODUCTION_MODE } from '@app/constants';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeController } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { UsersService } from './users.service';

@Controller('/users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiExcludeController(PRODUCTION_MODE)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('/:userId')
  async getUser() {
    return Promise.resolve({ version: 'v1' });
  }
}
