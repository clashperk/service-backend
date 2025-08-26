import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards';

@Controller('/tasks')
@UseGuards(ApiKeyGuard)
@ApiSecurity('apiKey')
export class TasksController {
  constructor() {}

  @Post('/')
  runTask() {
    return { message: 'Ok' };
  }
}
