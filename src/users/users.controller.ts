import { ApiExcludeRoute } from '@app/decorators';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { UsersService } from './users.service';
import { MessageOkDto } from '../links/dto';

@Controller('/users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiExcludeRoute()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('/:userId')
  async getUser(): Promise<MessageOkDto> {
    return Promise.resolve({ version: 'v1' });
  }
}
