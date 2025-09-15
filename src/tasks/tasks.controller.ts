import { PRODUCTION_MODE } from '@app/constants';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards';

@Controller('/tasks')
@UseGuards(ApiKeyGuard)
@ApiSecurity('apiKey')
@ApiExcludeController(PRODUCTION_MODE)
export class TasksController {
  constructor() {}

  @Post('/')
  runTask() {
    return { message: 'Ok' };
  }
}
