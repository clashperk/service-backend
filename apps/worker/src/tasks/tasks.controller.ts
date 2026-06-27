import { PRODUCTION_MODE } from '@app/constants';
import { ResultOkDto } from '@app/dto';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth';

@Controller('/tasks')
@UseGuards(ApiKeyGuard)
@ApiSecurity('apiKey')
@ApiExcludeController(PRODUCTION_MODE)
export class TasksController {
  constructor() {}

  @Post('/')
  runTask(): ResultOkDto {
    return { message: 'Ok' };
  }
}
