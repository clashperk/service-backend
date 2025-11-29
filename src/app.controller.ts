import { Cache } from '@app/decorators';
import { Controller, Get, Post, Req, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController, ApiResponse } from '@nestjs/swagger';
@Controller({
  path: '/',
  version: ['1', '2', VERSION_NEUTRAL],
})
@ApiExcludeController()
export class AppController {
  constructor() {}

  @Get('/')
  getHello(): string {
    return 'Hello World!';
  }

  @Get('/health')
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Ok',
        },
      },
    },
  })
  getHealth() {
    return { message: 'Ok' };
  }

  @Post('/cache-status-check')
  @Cache(30)
  cacheStatusCheckPOST(@Req() req: Request) {
    return {
      headers: { ...req.headers },
    };
  }

  @Get('/cache-status-check')
  @Cache(30)
  cacheStatusCheckGET(@Req() req: Request) {
    return {
      headers: { ...req.headers },
    };
  }
}
